/**
 * Configuration for the Survey System
 * แก้ไข APPS_SCRIPT_URL หลัง deploy Google Apps Script
 */
const APP_CONFIG = {
  // NOTE: เปลี่ยน URL นี้หลังจาก deploy Google Apps Script เป็น Web App
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwqAgfm8w5i0_6wTgu8WMLswwIOBPpXd-TQS4xk7LK6DMi36H-LvaiLuM-7z5Gd7YWClg/exec',

  // Rating labels
  RATING_LABELS: {
    5: 'มากที่สุด',
    4: 'มาก',
    3: 'ปานกลาง',
    2: 'น้อย',
    1: 'น้อยที่สุด'
  },

  // Chart colors
  COLORS: {
    primary: '#1a3a5c',
    secondary: '#c9a84c',
    accent: '#2196F3',
    success: '#4CAF50',
    warning: '#FF9800',
    danger: '#f44336',
    chartPalette: [
      '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
      '#10b981', '#ef4444', '#06b6d4', '#f97316'
    ]
  }
};
