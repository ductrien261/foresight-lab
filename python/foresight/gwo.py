"""Grey Wolf Optimizer.

The random stream matches the notebook draw for draw (per wolf, per leader:
r1 then r2), so `exact=True` with a per-vector cost reproduces published runs,
while the vectorised cost path is the fast one used in the browser."""

from __future__ import annotations

from typing import Callable, Optional

import numpy as np

BatchCost = Callable[[np.ndarray], np.ndarray]
Progress = Optional[Callable[[float], None]]


def gwo_optimize(
    batch_cost: BatchCost,
    n_params: int,
    n_wolves: int = 20,
    max_iter: int = 200,
    seed: int = 42,
    bounds: tuple[float, float] = (-2.0, 2.0),
    on_iter: Progress = None,
) -> tuple[np.ndarray, float, list[float]]:
    rng = np.random.RandomState(seed)
    lb, ub = bounds
    wolves = rng.uniform(lb, ub, (n_wolves, n_params))
    fitness = batch_cost(wolves)
    idx = np.argsort(fitness)
    alpha, beta, delta = wolves[idx[0]].copy(), wolves[idx[1]].copy(), wolves[idx[2]].copy()
    alpha_score = float(fitness[idx[0]])
    history = [alpha_score]
    leaders = np.stack([alpha, beta, delta])

    for t in range(max_iter):
        a = 2.0 - 2.0 * t / max_iter
        r = rng.rand(n_wolves * 3 * 2 * n_params).reshape(n_wolves, 3, 2, n_params)
        big_a = 2 * a * r[:, :, 0, :] - a
        big_c = 2 * r[:, :, 1, :]
        d = np.abs(big_c * leaders[None, :, :] - wolves[:, None, :])
        new_pos = np.zeros((n_wolves, n_params))
        for k in range(3):
            new_pos += leaders[k] - big_a[:, k, :] * d[:, k, :]
        wolves = np.clip(new_pos / 3.0, lb, ub)

        fitness = batch_cost(wolves)
        idx = np.argsort(fitness)
        if fitness[idx[0]] < alpha_score:
            alpha_score = float(fitness[idx[0]])
            leaders = np.stack([wolves[idx[0]].copy(), wolves[idx[1]].copy(), wolves[idx[2]].copy()])
        history.append(alpha_score)
        if on_iter is not None:
            on_iter((t + 1) / max_iter)

    return leaders[0].copy(), alpha_score, history


def gwo_multirun(
    batch_cost: BatchCost,
    n_params: int,
    n_runs: int = 30,
    n_wolves: int = 20,
    max_iter: int = 200,
    seed: int = 42,
    on_progress: Progress = None,
) -> tuple[np.ndarray, float, list[float]]:
    best_params: Optional[np.ndarray] = None
    best_score = np.inf
    best_history: list[float] = []
    for run in range(n_runs):

        def report(frac: float, run: int = run) -> None:
            if on_progress is not None:
                on_progress((run + frac) / n_runs)

        params, score, history = gwo_optimize(
            batch_cost, n_params, n_wolves=n_wolves, max_iter=max_iter, seed=seed + run, on_iter=report
        )
        if score < best_score:
            best_score, best_params, best_history = score, params.copy(), history
    assert best_params is not None
    return best_params, float(best_score), best_history


def per_vector(cost: Callable[[np.ndarray], float]) -> BatchCost:
    """Wrap a single-vector cost so it evaluates rows one by one (exact mode)."""
    return lambda pop: np.array([cost(w) for w in pop])
