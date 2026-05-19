import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from './Tabs';

function Wrapper() {
  const [active, setActive] = useState('fotos');
  return (
    <div>
      <Tabs
        ariaLabel="Documentos"
        idPrefix="doc"
        controlsPrefix="doc"
        tabs={[
          { id: 'fotos', label: 'Fotos' },
          { id: 'ultrassom', label: 'Ultrassom' },
          { id: 'pdf', label: 'PDF' },
          { id: 'seguranca', label: 'Segurança' },
        ]}
        active={active}
        onChange={setActive}
      />
      <div id="doc-panel-fotos" role="tabpanel" aria-labelledby="doc-tab-fotos" hidden={active !== 'fotos'}>Fotos</div>
      <div id="doc-panel-ultrassom" role="tabpanel" aria-labelledby="doc-tab-ultrassom" hidden={active !== 'ultrassom'}>Ultrassom</div>
      <div id="doc-panel-pdf" role="tabpanel" aria-labelledby="doc-tab-pdf" hidden={active !== 'pdf'}>PDF</div>
      <div id="doc-panel-seguranca" role="tabpanel" aria-labelledby="doc-tab-seguranca" hidden={active !== 'seguranca'}>Segurança</div>
    </div>
  );
}

describe('Tabs', () => {
  it('alterna corretamente via clique e seta do teclado', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    expect(screen.getByRole('tab', { name: 'Fotos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Fotos');

    await user.click(screen.getByRole('tab', { name: 'Ultrassom' }));
    expect(screen.getByRole('tab', { name: 'Ultrassom' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Ultrassom');

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'PDF' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('PDF');

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Segurança' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Segurança');

    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Fotos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Fotos');
  });
});
