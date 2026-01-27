// src/main/controllers/userController.js
import { ipcMain } from 'electron';
import userService from '../services/UserService.js'; // .js extension එක අනිවාර්යයි

export function registerUserHandlers() {
    // Get All Users
    ipcMain.handle('users:get-all', async () => {
        try {
            const users = await userService.getAllUsers();
            return { success: true, data: users };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Add User
    ipcMain.handle('users:add', async (event, userData) => {
        try {
            await userService.addUser(userData);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Login
    ipcMain.handle('auth:login', async (event, { username, password }) => {
        try {
            return await userService.login(username, password);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Delete User
    ipcMain.handle('users:delete', async (event, userId) => {
        try {
            await userService.deleteUser(userId);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // userController.js ඇතුළට මේකත් එකතු කරන්න
ipcMain.handle('users:update', async (event, userData) => {
    try {
        await userService.updateUser(userData);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
}