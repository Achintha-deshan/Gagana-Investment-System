import { ipcMain } from 'electron';
import employeeService from '../services/EmpService.js';

export function registerEmployeeHandlers() {
    ipcMain.handle('employee:get-all', () => employeeService.getAll());
    ipcMain.handle('employee:get-next-id', () => employeeService.generateNextEmployeeId());
    ipcMain.handle('employee:add', (event, data) => employeeService.add(data));
    ipcMain.handle('employee:update', (event, data) => employeeService.update(data));
    ipcMain.handle('employee:delete', (event, id) => employeeService.delete(id));
}