import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import ProductionPage from '../../src/pages/ProductionPage/ProductionPage';
import { useAuth } from '../../src/context/AuthContext';
import { getRecipes, getRecipeById } from '../../src/services/recipes.service';
import { getProductionLogs, registerProduction } from '../../src/services/production.service';

// Mock del AuthContext
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock de servicios de recetas
vi.mock('../../src/services/recipes.service', () => ({
  getRecipes: vi.fn(),
  getRecipeById: vi.fn(),
}));

// Mock de servicios de producción
vi.mock('../../src/services/production.service', () => ({
  getProductionLogs: vi.fn(),
  registerProduction: vi.fn(),
}));

describe('ProductionPage Integration Tests', () => {
  const mockRecipes = [
    { id: '1', name: 'Torta de Coco', units_per_batch: 10 },
    { id: '2', name: 'Brownie', units_per_batch: 24 },
  ];

  const mockRecipeDetail = {
    id: '1',
    name: 'Torta de Coco',
    units_per_batch: 10,
    recipe_ingredients: [
      {
        id: 'ri-1',
        ingredient_id: 'ing-1',
        quantity_used: 100,
        ingredients: {
          id: 'ing-1',
          name: 'Coco rallado',
          unit: 'gr',
          inventory: [{ current_stock: 500 }],
        },
      },
    ],
  };

  const mockLogs = [
    {
      id: 'log-1',
      date: '2026-06-22T10:00:00Z',
      recipe_id: '1',
      units_produced: 10,
      actual_ingredients: [{ ingredientId: 'ing-1', quantityUsed: 100 }],
      notes: 'Lote perfecto',
      recipes: { name: 'Torta de Coco' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: 'u-1' },
      role: 'admin',
      isAdmin: true,
      hasPermission: () => true,
    });

    getRecipes.mockResolvedValue(mockRecipes);
    getRecipeById.mockResolvedValue(mockRecipeDetail);
    getProductionLogs.mockResolvedValue(mockLogs);
  });

  it('renders recipe list and recent logs', async () => {
    render(<ProductionPage />);

    // Ver si muestra el spinner o carga rápido
    expect(screen.getByText(/Cargando/i)).toBeInTheDocument();

    // Esperar a que cargue
    await waitFor(() => {
      expect(screen.getByText('Torta de Coco (10 unid/bandeja)')).toBeInTheDocument();
    });

    // Validar tabla de historial
    expect(screen.getByText('Lote perfecto')).toBeInTheDocument();
    expect(screen.getByText('+10 unid.')).toBeInTheDocument();
  });

  it('loads recipe details when selected and scales default quantities', async () => {
    render(<ProductionPage />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });

    // Esperar a que cargue los detalles de la receta
    await waitFor(() => {
      expect(screen.getByText(/Receta: Torta de Coco/)).toBeInTheDocument();
    });

    // Coco rallado es ingrediente
    expect(screen.getByText('Coco rallado')).toBeInTheDocument();
    // Stock actual es 500 gr
    expect(screen.getByText('500 gr')).toBeInTheDocument();
    // Sugerido es 100 gr
    expect(screen.getByText('100 gr')).toBeInTheDocument();

    // Verificamos que el input del gastado real tenga '100'
    const input = screen.getByDisplayValue('100');
    expect(input).toBeInTheDocument();
  });
});
