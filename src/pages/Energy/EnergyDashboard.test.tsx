import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { ENERGY } from '@/content/vi';
import { AppPrefsProvider } from '@/contexts/AppPrefsContext';

import EnergyDashboard from './EnergyDashboard';

function renderPage() {
  window.localStorage.setItem('fl.onboarded', 'true');
  return render(
    <MemoryRouter>
      <AppPrefsProvider>
        <EnergyDashboard />
      </AppPrefsProvider>
    </MemoryRouter>,
  );
}

describe('Energy dashboard', () => {
  it('updates the 2030 figure in the sidebar when a scenario preset is chosen', async () => {
    const user = userEvent.setup();
    renderPage();
    const sidebar = screen.getByRole('complementary', { name: ENERGY.scenario.title });
    expect(within(sidebar).getByText('2.006,62')).toBeInTheDocument();
    await user.click(within(sidebar).getByRole('radio', { name: 'Cao' }));
    expect(within(sidebar).getByText('2.033,09')).toBeInTheDocument();
  });

  it('switches the insight cards when the perspective changes', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('radio', { name: 'Quản lý nhà nước' }));
    expect(screen.getByText('Cung cần bổ sung')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Nhà đầu tư' }));
    expect(screen.getByText('Mức tăng sàn')).toBeInTheDocument();
    expect(screen.getByText('Biên độ kịch bản')).toBeInTheDocument();
  });

  it('shows the regression comparison line only while the comparison box is ticked', async () => {
    const user = userEvent.setup();
    renderPage();
    const box = screen.getByRole('checkbox', { name: ENERGY.trend.compare });
    expect(box).toBeChecked();
    expect(screen.getByText(ENERGY.legend.alt)).toBeInTheDocument();
    await user.click(box);
    expect(screen.queryByText(ENERGY.legend.alt)).not.toBeInTheDocument();
    await user.click(box);
    expect(screen.getByText(ENERGY.legend.alt)).toBeInTheDocument();
  });

  it('changes the forecast horizon while keeping the plan comparison at 2030', async () => {
    const user = userEvent.setup();
    renderPage();
    const sidebar = screen.getByRole('complementary', { name: ENERGY.scenario.title });
    const planGap = within(sidebar).getByText('+204');
    expect(planGap).toBeInTheDocument();

    await user.click(within(sidebar).getByRole('radio', { name: '1 năm' }));
    expect(within(sidebar).getByText('Nhu cầu dự báo 2025')).toBeInTheDocument();
    expect(within(sidebar).getByText('1.494,87')).toBeInTheDocument();
    expect(within(sidebar).getByText('+204')).toBeInTheDocument();

    await user.click(within(sidebar).getByRole('radio', { name: '10 năm' }));
    expect(within(sidebar).getByText('Nhu cầu dự báo 2034')).toBeInTheDocument();
    expect(within(sidebar).getByText(ENERGY.horizon.beyondReport(2030))).toBeInTheDocument();
    expect(within(sidebar).getByText('+204')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /^2034/ })).toBeInTheDocument();

    await user.click(within(sidebar).getByRole('radio', { name: ENERGY.horizon.custom }));
    expect(within(sidebar).getByRole('slider', { name: ENERGY.horizon.customLabel })).toHaveAttribute(
      'aria-valuenow',
      '10',
    );
  });
});
