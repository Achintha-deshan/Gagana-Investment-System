import { ipcMain } from 'electron';
import customerService from '../services/CustomerService.js';

export function registerCustomerHandlers() {
    ipcMain.handle('customers:get-all', () => customerService.getAll());
    ipcMain.handle('customers:get-next-id', () => customerService.generateNextCustomerId());
    ipcMain.handle('customers:add', (event, data) => customerService.add(data));
    ipcMain.handle('customers:update', (event, data) => customerService.update(data));
    ipcMain.handle('customers:delete', (event, id) => customerService.delete(id));
    ipcMain.handle('customers:search', async (event, query) => {
         return await customerService.searchCustomer(query);
    });
}