import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { inventoryApi } from '../services/inventory-api';
import type { Product } from '../types';
import { ProductFormPage } from './product-form-page';

vi.mock('../services/inventory-api', () => ({
  inventoryApi: {
    listCategories: vi.fn(),
    listBrands: vi.fn(),
    getProduct: vi.fn(),
    updateProduct: vi.fn(),
    createProduct: vi.fn(),
    updateProductMinimumStock: vi.fn(),
  },
}));

const showToast = vi.fn();

const product: Product = {
  id: 'product-1',
  code: 'PR-001',
  name: 'Alimento para perro',
  description: 'Saco de 15 kg',
  unitPrice: '25.50',
  stock: 10,
  minimumStock: null,
  category: { id: 'category-1', name: 'Alimentos' },
  brand: { id: 'brand-1', name: 'Dog Chow' },
  createdAt: '2026-11-19T00:00:00.000Z',
};

function renderPage(path = '/inventory/products/product-1/edit') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
        <Routes>
          <Route path="/inventory/products/new" element={<ProductFormPage />} />
          <Route path="/inventory/products/:id/edit" element={<ProductFormPage />} />
        </Routes>
      </ToastContext.Provider>
    </MemoryRouter>,
  );
}

async function loadProduct(overrides: Partial<Product> = {}) {
  vi.mocked(inventoryApi.listCategories).mockResolvedValue([]);
  vi.mocked(inventoryApi.listBrands).mockResolvedValue([]);
  vi.mocked(inventoryApi.getProduct).mockResolvedValue({ ...product, ...overrides });
  renderPage();
  await screen.findByDisplayValue(product.code);
}

describe('ProductFormPage stock mínimo (HU-03)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('escenario 1: configura el stock mínimo de un producto sin umbral', async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryApi.updateProductMinimumStock).mockResolvedValue({ id: 'product-1', minimumStock: 10 });
    await loadProduct();

    expect(screen.getByText('Valor actual: Sin configurar')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Stock mínimo'), '10');
    await user.click(screen.getByRole('button', { name: 'Guardar stock mínimo' }));

    await waitFor(() => expect(inventoryApi.updateProductMinimumStock).toHaveBeenCalledWith('product-1', 10));
    expect(showToast).toHaveBeenCalledWith('Stock mínimo registrado correctamente', 'success');
    expect(screen.getByText('Valor actual: 10')).toBeInTheDocument();
  });

  it('escenario 2: actualiza el stock mínimo existente y muestra el nuevo valor', async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryApi.updateProductMinimumStock).mockResolvedValue({ id: 'product-1', minimumStock: 25 });
    await loadProduct({ minimumStock: 5 });

    const input = screen.getByLabelText('Stock mínimo');
    expect(screen.getByText('Valor actual: 5')).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, '25');
    await user.click(screen.getByRole('button', { name: 'Guardar stock mínimo' }));

    await waitFor(() => expect(inventoryApi.updateProductMinimumStock).toHaveBeenCalledWith('product-1', 25));
    expect(showToast).toHaveBeenCalledWith('Stock mínimo actualizado correctamente', 'success');
    expect(screen.getByText('Valor actual: 25')).toBeInTheDocument();
  });

  it('acepta 0 como umbral configurado', async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryApi.updateProductMinimumStock).mockResolvedValue({ id: 'product-1', minimumStock: 0 });
    await loadProduct({ minimumStock: 5 });

    const input = screen.getByLabelText('Stock mínimo');
    await user.clear(input);
    await user.type(input, '0');
    await user.click(screen.getByRole('button', { name: 'Guardar stock mínimo' }));

    await waitFor(() => expect(inventoryApi.updateProductMinimumStock).toHaveBeenCalledWith('product-1', 0));
    expect(screen.getByText('Valor actual: 0')).toBeInTheDocument();
  });

  it.each([
    ['vacío', 'El stock mínimo debe ser un número entero positivo'],
    ['abc', 'El stock mínimo debe ser un número entero positivo'],
    ['$10', 'El stock mínimo debe ser un número entero positivo'],
    ['2.5', 'El stock mínimo debe ser un número entero positivo'],
    ['-5', 'El stock mínimo no puede ser negativo'],
  ])('escenarios 3, 4 y 5: rechaza el valor %s sin llamar a la API', async (value, message) => {
    const user = userEvent.setup();
    await loadProduct();

    const input = screen.getByLabelText('Stock mínimo');
    if (value) await user.type(input, value);
    await user.click(screen.getByRole('button', { name: 'Guardar stock mínimo' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(inventoryApi.updateProductMinimumStock).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('muestra el error de la API cuando la actualización falla', async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryApi.updateProductMinimumStock).mockRejectedValue(new Error('No se pudo guardar el stock mínimo'));
    await loadProduct();

    await user.type(screen.getByLabelText('Stock mínimo'), '10');
    await user.click(screen.getByRole('button', { name: 'Guardar stock mínimo' }));

    expect(await screen.findByText('No se pudo guardar el stock mínimo')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith('No se pudo guardar el stock mínimo', 'error');
  });

  it('no ofrece el stock mínimo al registrar un producto nuevo', async () => {
    vi.mocked(inventoryApi.listCategories).mockResolvedValue([]);
    vi.mocked(inventoryApi.listBrands).mockResolvedValue([]);
    renderPage('/inventory/products/new');

    await screen.findByPlaceholderText('Ej. PR-001');

    expect(screen.queryByLabelText('Stock mínimo')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar stock mínimo' })).not.toBeInTheDocument();
  });
});
