"""First-order Takagi-Sugeno ANFIS with Gaussian membership functions.

Parameter layout is identical to the notebook: premise (rules x inputs x [c, sigma])
followed by consequent (rules x [p_1..p_n, r])."""

from __future__ import annotations

import numpy as np


class ANFIS:
    def __init__(self, n_inputs: int, n_rules: int) -> None:
        self.n_inputs = n_inputs
        self.n_rules = n_rules
        self.n_premise = n_rules * n_inputs * 2
        self.n_consequent = n_rules * (n_inputs + 1)
        self.n_params = self.n_premise + self.n_consequent

    @staticmethod
    def _gaussian(x: np.ndarray, c: float, sigma: float) -> np.ndarray:
        return np.exp(-0.5 * ((x - c) / (np.abs(sigma) + 1e-8)) ** 2)

    def predict(self, x: np.ndarray, params: np.ndarray) -> np.ndarray:
        """Loop version, numerically identical to the notebook."""
        n = x.shape[0]
        premise = params[: self.n_premise].reshape(self.n_rules, self.n_inputs, 2)
        consequent = params[self.n_premise :].reshape(self.n_rules, self.n_inputs + 1)
        mu = np.ones((n, self.n_rules))
        for r in range(self.n_rules):
            for j in range(self.n_inputs):
                mu[:, r] *= self._gaussian(x[:, j], premise[r, j, 0], premise[r, j, 1])
        w_bar = mu / (mu.sum(axis=1, keepdims=True) + 1e-8)
        x_aug = np.hstack([x, np.ones((n, 1))])
        out = np.zeros(n)
        for r in range(self.n_rules):
            out += w_bar[:, r] * (x_aug @ consequent[r])
        return out

    def predict_many(self, x: np.ndarray, population: np.ndarray) -> np.ndarray:
        """Vectorised over a population of parameter vectors: returns (W, n)."""
        w = population.shape[0]
        premise = population[:, : self.n_premise].reshape(w, self.n_rules, self.n_inputs, 2)
        consequent = population[:, self.n_premise :].reshape(w, self.n_rules, self.n_inputs + 1)
        c = premise[..., 0][:, None, :, :]
        s = np.abs(premise[..., 1])[:, None, :, :] + 1e-8
        z = (x[None, :, None, :] - c) / s
        mu = np.exp(-0.5 * z**2).prod(axis=3)
        w_bar = mu / (mu.sum(axis=2, keepdims=True) + 1e-8)
        x_aug = np.hstack([x, np.ones((x.shape[0], 1))])
        rule_out = np.einsum("nk,wrk->wnr", x_aug, consequent)
        return (w_bar * rule_out).sum(axis=2)

    def mse(self, params: np.ndarray, x: np.ndarray, y: np.ndarray) -> float:
        return float(np.mean((y - self.predict(x, params)) ** 2))

    def mse_many(self, population: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
        return np.mean((y[None, :] - self.predict_many(x, population)) ** 2, axis=1)
