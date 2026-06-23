import { describe, it, expect } from 'vitest';
import {
  calcUnitPrice,
  calcIngredientCost,
  calcTotalIngredientsCost,
  calcTotalExtraCosts,
  calcBatchCost,
  calcUnitCost,
  calcSuggestedPrice,
  calcProfitPerUnit,
  calcTotalBatchProfit,
  calcLaborCost,
  calcProfitSplit,
  calcRemainingStock,
  calcToBuy,
  calcRecipeSummary,
  getRecipePricing,
} from '../../../src/utils/calculations';

describe('calculations.js unit tests', () => {
  describe('calcUnitPrice', () => {
    it('should divide price by quantity correctly', () => {
      expect(calcUnitPrice(10000, 500)).toBe(20);
      expect(calcUnitPrice(8750, 500)).toBe(17.5);
    });

    it('should return 0 when quantity is zero or missing', () => {
      expect(calcUnitPrice(1000, 0)).toBe(0);
      expect(calcUnitPrice(1000, null)).toBe(0);
    });
  });

  describe('calcIngredientCost', () => {
    it('should multiply unit price by quantity used', () => {
      expect(calcIngredientCost(17.5, 200)).toBe(3500);
    });
  });

  describe('calcTotalIngredientsCost', () => {
    it('should sum all ingredient costs in recipe', () => {
      const ingredients = [
        { unitPrice: 10, quantityUsed: 200 }, // 2000
        { unitPrice: 5, quantityUsed: 100 },  // 500
      ];
      expect(calcTotalIngredientsCost(ingredients)).toBe(2500);
    });
  });

  describe('calcTotalExtraCosts', () => {
    it('should sum all extra costs correctly', () => {
      const extraCosts = [
        { quantity: 2, unitPrice: 500 }, // 1000
        { quantity: 1, unitPrice: 2000 }, // 2000
      ];
      expect(calcTotalExtraCosts(extraCosts)).toBe(3000);
    });
  });

  describe('calcBatchCost', () => {
    it('should sum ingredients cost and extra costs', () => {
      expect(calcBatchCost(5000, 3000)).toBe(8000);
    });
  });

  describe('calcUnitCost', () => {
    it('should divide batch cost by units per batch', () => {
      expect(calcUnitCost(8000, 20)).toBe(400);
    });

    it('should return 0 if units per batch is 0 or null', () => {
      expect(calcUnitCost(8000, 0)).toBe(0);
    });
  });

  describe('calcSuggestedPrice', () => {
    it('should calculate suggested price with profit margin', () => {
      expect(calcSuggestedPrice(400, 50)).toBe(600); // 400 * 1.5
      expect(calcSuggestedPrice(1000, 100)).toBe(2000); // 1000 * 2.0
    });
  });

  describe('calcProfitPerUnit', () => {
    it('should subtract unit cost from selling price', () => {
      expect(calcProfitPerUnit(600, 400)).toBe(200);
    });
  });

  describe('calcTotalBatchProfit', () => {
    it('should multiply profit per unit by total units', () => {
      expect(calcTotalBatchProfit(200, 20)).toBe(4000);
    });
  });

  describe('calcLaborCost', () => {
    it('should sum only costs of type labor', () => {
      const extraCosts = [
        { quantity: 1, unitPrice: 5000, type: 'labor' },
        { quantity: 2, unitPrice: 500, type: 'packaging' },
        { quantity: 1, unitPrice: 1000, type: 'labor' },
      ];
      expect(calcLaborCost(extraCosts)).toBe(6000);
    });
  });

  describe('calcProfitSplit', () => {
    it('should split profits equally and award labor cost to owner', () => {
      // Total profit: 10000, Labor: 2000
      // Partner gets = 10000 / 2 = 5000
      // Owner gets = 5000 + 2000 = 7000
      const split = calcProfitSplit(10000, 2000);
      expect(split.partnerProfit).toBe(5000);
      expect(split.ownerProfit).toBe(7000);
    });
  });

  describe('calcRemainingStock', () => {
    it('should deduct used quantity and not go below 0', () => {
      expect(calcRemainingStock(500, 200)).toBe(300);
      expect(calcRemainingStock(100, 200)).toBe(0);
    });
  });

  describe('calcToBuy', () => {
    it('should return enough if stock >= needed', () => {
      const res = calcToBuy(300, 500, 500);
      expect(res.enoughInStock).toBe(true);
      expect(res.shortage).toBe(0);
      expect(res.toBuy).toBe(0);
    });

    it('should recommend buying minimum if shortage is less than provider minimum', () => {
      const res = calcToBuy(600, 500, 500); // shortage = 100, min = 500
      expect(res.enoughInStock).toBe(false);
      expect(res.shortage).toBe(100);
      expect(res.toBuy).toBe(500);
    });

    it('should recommend buying exact shortage if shortage is greater than provider minimum', () => {
      const res = calcToBuy(1200, 500, 500); // shortage = 700, min = 500
      expect(res.enoughInStock).toBe(false);
      expect(res.shortage).toBe(700);
      expect(res.toBuy).toBe(700);
    });
  });

  describe('calcRecipeSummary', () => {
    it('should compute full cost and split breakdown', () => {
      const ingredients = [
        { unitPrice: 10, quantityUsed: 200 }, // 2000
      ];
      const extraCosts = [
        { quantity: 1, unitPrice: 1000, type: 'labor' }, // 1000
        { quantity: 2, unitPrice: 500, type: 'packaging' }, // 1000
      ];

      // Batch cost = 2000 + 2000 = 4000
      // Unit cost = 4000 / 10 = 400
      // Suggested selling price (50% profit) = 400 * 1.5 = 600
      // Selling price (rounded override) = 700
      // Profit per unit = 700 - 400 = 300
      // Total profit = 300 * 10 = 3000
      // Labor cost = 1000
      // Split (with partner):
      //   Partner gets = 3000 / 2 = 1500
      //   Owner gets = 1500 + 1000 (labor) = 2500
      
      const summary = calcRecipeSummary({
        ingredients,
        extraCosts,
        unitsPerBatch: 10,
        profitPercentage: 50,
        roundedPrice: 700,
        hasPartner: true,
      });

      expect(summary.ingredientsCost).toBe(2000);
      expect(summary.extraCostsTotal).toBe(2000);
      expect(summary.batchCost).toBe(4000);
      expect(summary.unitCost).toBe(400);
      expect(summary.suggestedPrice).toBe(600);
      expect(summary.sellingPrice).toBe(700);
      expect(summary.profitPerUnit).toBe(300);
      expect(summary.totalProfit).toBe(3000);
      expect(summary.laborCost).toBe(1000);
      expect(summary.partnerProfit).toBe(1500);
      expect(summary.ownerProfit).toBe(2500);
    });
  });

  describe('getRecipePricing', () => {
    it('should return empty object if recipe or recipe_pricing is missing', () => {
      expect(getRecipePricing(null)).toEqual({});
      expect(getRecipePricing({})).toEqual({});
    });

    it('should return the object itself if recipe_pricing is a single object', () => {
      const recipe = { recipe_pricing: { rounded_price: 5000 } };
      expect(getRecipePricing(recipe)).toEqual({ rounded_price: 5000 });
    });

    it('should return the first element if recipe_pricing is an array', () => {
      const recipe = { recipe_pricing: [{ rounded_price: 6000 }] };
      expect(getRecipePricing(recipe)).toEqual({ rounded_price: 6000 });
    });
  });
});

