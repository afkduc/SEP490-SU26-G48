export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

// Landing gio chiem GOC domain (khong con basePath trong next.config.mjs
// nua) - de rong thay vi xoa han bien nay, vi cac cho dang dung BASE_PATH de
// tro toi anh tinh trong public/ (khong tu them tien to nhu next/link) van
// hoat dong dung, chi la khong con them gi vao truoc nua.
export const BASE_PATH = '';
