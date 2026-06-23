import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatNumber,
  getUnitLabel,
  formatQuantity,
  getExtraCostTypeLabel,
  formatDate,
  formatDateTime,
  formatPercentage,
  truncate,
  capitalize,
} from '../../../src/utils/formatters';

describe('formatters.js unit tests', () => {
  describe('formatCurrency', () => {
    it('should format COP currency correctly', () => {
      // COP is usually formatted without decimals in es-CO
      const result = formatCurrency(5000);
      expect(result).toContain('$');
      expect(result).toContain('5.000');
    });

    it('should handle null/undefined/NaN', () => {
      expect(formatCurrency(null)).toBe('$ 0');
      expect(formatCurrency(undefined)).toBe('$ 0');
      expect(formatCurrency(NaN)).toBe('$ 0');
    });

    it('should format compact values', () => {
      expect(formatCurrency(1500000, true)).toBe('$ 1.5M');
      expect(formatCurrency(25000, true)).toBe('$ 25K');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with Colombian thousands separator', () => {
      expect(formatNumber(1250)).toBe('1.250');
    });

    it('should round decimal numbers', () => {
      expect(formatNumber(1250.7)).toBe('1.251');
    });
  });

  describe('getUnitLabel', () => {
    it('should return correct readable labels', () => {
      expect(getUnitLabel('gr')).toBe('Gramos (gr)');
      expect(getUnitLabel('unidad')).toBe('Unidad');
      expect(getUnitLabel('custom')).toBe('custom'); // returns input if not found
    });
  });

  describe('formatQuantity', () => {
    it('should join quantity and unit label correctly', () => {
      expect(formatQuantity(500, 'gr')).toBe('500 gr');
    });
  });

  describe('getExtraCostTypeLabel', () => {
    it('should return extra cost type label', () => {
      expect(getExtraCostTypeLabel('packaging')).toBe('📦 Empaque');
      expect(getExtraCostTypeLabel('labor')).toBe('👐 Mano de obra');
    });
  });

  describe('formatDate', () => {
    it('should format Date objects into readable Spanish dates', () => {
      const date = new Date(2026, 5, 22); // 22 de junio de 2026
      const formatted = formatDate(date);
      expect(formatted).toContain('22');
      expect(formatted).toContain('junio');
      expect(formatted).toContain('2026');
    });
  });

  describe('formatDateTime', () => {
    it('should format dates with times', () => {
      const date = new Date(2026, 5, 22, 14, 30, 0); // 22 de jun de 2026, 14:30 / 02:30 p.m.
      const formatted = formatDateTime(date);
      expect(formatted).toContain('22');
      expect(formatted).toContain('jun');
      expect(formatted).toContain('2026');
      expect(formatted).to.match(/(14|02|2):30/);
    });
  });

  describe('formatPercentage', () => {
    it('should add % to numbers', () => {
      expect(formatPercentage(50)).toBe('50%');
      expect(formatPercentage(null)).toBe('0%');
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(truncate('Este es un texto super largo que debe cortarse', 10)).toBe('Este es un...');
      expect(truncate('Corto', 10)).toBe('Corto');
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter and lowercase the rest', () => {
      expect(capitalize('HOLA MUNDO')).toBe('Hola mundo');
      expect(capitalize('hola')).toBe('Hola');
    });
  });
});
