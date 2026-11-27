import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiException } from '../../common/errors/api-exception.js';
import { success } from '../../common/errors/api-response.js';
import { RequirePermissions } from '../identity/decorators/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../identity/types/authenticated-request.js';
import { AdjustBatchStockDto } from './dtos/adjust-batch-stock.dto.js';
import { CreateCatalogItemDto } from './dtos/create-catalog-item.dto.js';
import { CreateProductDto } from './dtos/create-product.dto.js';
import { ListProductsQueryDto } from './dtos/list-products-query.dto.js';
import { RegisterBatchEntryDto } from './dtos/register-batch-entry.dto.js';
import { UpdateCategoryVatDto } from './dtos/update-category-vat.dto.js';
import { UpdateBatchExpirationDto } from './dtos/update-batch-expiration.dto.js';
import { UpdateMinimumStockDto } from './dtos/update-minimum-stock.dto.js';
import { InventoryService } from './services/inventory.service.js';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('categories')
  @RequirePermissions('inventory:read')
  async listCategories() {
    return success(await this.inventoryService.listCategories());
  }

  @Post('categories')
  @RequirePermissions('inventory:manage-categories')
  async createCategory(@Body() input: CreateCatalogItemDto) {
    return success(await this.inventoryService.createCategory(input), 'Categoría creada correctamente', 201);
  }

  @Patch('categories/:id')
  @RequirePermissions('inventory:manage-categories')
  async updateCategory(@Param('id') id: string, @Body() input: CreateCatalogItemDto) {
    return success(await this.inventoryService.updateCategory(id, input), 'Categoría actualizada correctamente');
  }

  @Patch('categories/:id/vat')
  @RequirePermissions('inventory:configure-vat')
  async updateCategoryVat(@Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateCategoryVatDto) {
    return success(await this.inventoryService.updateCategoryVat(id, input.vatRate), 'IVA actualizado correctamente');
  }

  @Get('brands')
  @RequirePermissions('inventory:read')
  async listBrands() {
    return success(await this.inventoryService.listBrands());
  }

  @Post('brands')
  @RequirePermissions('inventory:manage-brands')
  async createBrand(@Body() input: CreateCatalogItemDto) {
    return success(await this.inventoryService.createBrand(input), 'Marca creada correctamente', 201);
  }

  @Patch('brands/:id')
  @RequirePermissions('inventory:manage-brands')
  async updateBrand(@Param('id') id: string, @Body() input: CreateCatalogItemDto) {
    return success(await this.inventoryService.updateBrand(id, input), 'Marca actualizada correctamente');
  }

  @Get('products')
  @RequirePermissions('inventory:read')
  async listProducts(@Query() filtros: ListProductsQueryDto) {
    const productos = await this.inventoryService.listProducts(filtros);
    return success(productos, productos.length === 0 ? 'No se encontraron productos' : undefined);
  }

  @Get('expiration-alerts')
  @RequirePermissions('inventory:read')
  async listExpirationAlerts() {
    return success(await this.inventoryService.listExpirationAlerts());
  }

  @Get('batches/:id')
  @RequirePermissions('inventory:read')
  async getBatch(@Param('id') id: string) {
    return success(await this.inventoryService.getBatch(id));
  }

  @Get('batches/:id/movements')
  @RequirePermissions('inventory:read')
  async listBatchMovements(@Param('id', ParseUUIDPipe) id: string) {
    return success(await this.inventoryService.listBatchMovements(id));
  }

  @Post('batches/:id/adjustments')
  @RequirePermissions('inventory:adjust-stock')
  async adjustBatchStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AdjustBatchStockDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) throw ApiException.unauthorized();
    return success(
      await this.inventoryService.adjustBatchStock(id, input, request.user.id),
      'Existencias del lote ajustadas correctamente',
      201,
    );
  }

  @Patch('batches/:id/expiration-date')
  @RequirePermissions('inventory:register-entry')
  async updateBatchExpiration(@Param('id') id: string, @Body() input: UpdateBatchExpirationDto) {
    return success(
      await this.inventoryService.updateBatchExpiration(id, input.expirationDate),
      'Fecha de caducidad actualizada correctamente',
    );
  }

  @Get('products/:id')
  @RequirePermissions('inventory:read')
  async getProduct(@Param('id') id: string) {
    return success(await this.inventoryService.getProduct(id));
  }

  @Post('products')
  @RequirePermissions('inventory:manage-products')
  async createProduct(@Body() input: CreateProductDto) {
    return success(await this.inventoryService.createProduct(input), 'Producto registrado correctamente', 201);
  }

  @Patch('products/:id')
  @RequirePermissions('inventory:manage-products')
  async updateProduct(@Param('id') id: string, @Body() input: CreateProductDto) {
    return success(await this.inventoryService.updateProduct(id, input), 'Producto actualizado correctamente');
  }

  // HU-03: Gerente y Bodeguero configuran o actualizan el stock mínimo.
  @Patch('products/:id/minimum-stock')
  @RequirePermissions('inventory:manage-products')
  async updateProductMinimumStock(@Param('id') id: string, @Body() input: UpdateMinimumStockDto) {
    const { isFirstConfiguration, ...product } = await this.inventoryService.updateProductMinimumStock(id, input.minimumStock);
    return success(
      product,
      isFirstConfiguration ? 'Stock mínimo registrado correctamente' : 'Stock mínimo actualizado correctamente',
    );
  }

  // HU-02: solo quien tiene inventory:register-entry (Bodeguero) registra entradas de lote.
  @Post('batches')
  @RequirePermissions('inventory:register-entry')
  async registerBatchEntry(@Body() input: RegisterBatchEntryDto) {
    return success(await this.inventoryService.registerBatchEntry(input), 'Entrada de lote registrada correctamente', 201);
  }
}
