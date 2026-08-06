/**
 * Patch History API TRƯỚC mọi import react-router.
 * Router có thể giữ reference replaceState lúc load module — import file này
 * phải là dòng đầu trong main.jsx.
 */
import { ensureCrmHistoryBase } from './utils/ensureCrmHistoryBase';

ensureCrmHistoryBase();
