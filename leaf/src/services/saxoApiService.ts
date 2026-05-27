/**
 * saxoApiService.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Typed bridge between LEAF PRO and the Saxo Investment Backend.
 * All real money operations (login, trade, balance) go through here.
 * LEAF's chart display and manipulation engine remain completely separate.
 * ─────────────────────────────────────────────────────────────────────────
 */

const API_BASE = import.meta.env.VITE_SAXO_API_URL || (
  typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '' ||
    window.location.protocol === 'file:'
  )
    ? 'http://localhost:5000/api'
    : (typeof window !== 'undefined' ? window.location.origin + '/api' : 'http://localhost:5000/api')
);

// ── Types ────────────────────────────────────────────────────────────────
export interface SaxoUser {
  id: string;
  fullName: string;
  email: string;
  buyingPower: number;
  totalPortfolioValue: number;
  memberTier: 'Standard' | 'Pro' | 'Elite';
  profitLoss30d?: number;
  activeTrades?: number;
  isAdmin?: boolean;
}

export interface SaxoHolding {
  _id: string;
  symbol: string;
  assetName: string;
  shares: number;
  averagePrice: number;
  currentPrice: number;
}

export interface SaxoTransaction {
  _id: string;
  symbol: string;
  assetName: string;
  type: 'Buy' | 'Sell' | 'Deposit' | 'Withdrawal' | 'Transfer';
  quantity: string;
  amountUSD: number;
  pricePerUnit: number;
  status: 'Completed' | 'Pending' | 'Failed';
  description: string;
  timestamp: string;
}

export interface TradeResult {
  message: string;
  shares: string;
  symbol: string;
  price: number;
  remainingBuyingPower: number;
}

export interface AuthResult {
  token: string;
  user: SaxoUser;
  message: string;
}

// ── Token management ─────────────────────────────────────────────────────
export const TokenStore = {
  get(): string | null {
    return localStorage.getItem('leaf_saxo_token') || localStorage.getItem('auth_token') || localStorage.getItem('token');
  },
  set(token: string) {
    localStorage.setItem('leaf_saxo_token', token);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('token', token);
  },
  clear() {
    localStorage.removeItem('leaf_saxo_token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('token');
    localStorage.removeItem('leaf_saxo_user');
    localStorage.removeItem('user_data');
    localStorage.removeItem('user');
  },
  getUser(): SaxoUser | null {
    const raw = localStorage.getItem('leaf_saxo_user') || localStorage.getItem('user_data') || localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  },
  setUser(user: SaxoUser) {
    localStorage.setItem('leaf_saxo_user', JSON.stringify(user));
    localStorage.setItem('user_data', JSON.stringify(user));
    localStorage.setItem('user', JSON.stringify(user));
  },
};

// ── Internal fetch helper ────────────────────────────────────────────────
async function apiCall<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = TokenStore.get();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `API Error ${response.status}`);
  }

  return data as T;
}

// ── Auth ─────────────────────────────────────────────────────────────────

/** Login with email and password. Saves token + user to localStorage. */
export async function login(email: string, password: string): Promise<AuthResult> {
  const result = await apiCall<AuthResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  TokenStore.set(result.token);
  TokenStore.setUser(result.user);
  return result;
}

/** Register a new user. Saves token + user to localStorage. */
export async function register(fullName: string, email: string, password: string): Promise<AuthResult> {
  const result = await apiCall<AuthResult>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ fullName, email, password }),
  });
  TokenStore.set(result.token);
  TokenStore.setUser(result.user);
  return result;
}

/** Fetch current user profile from Saxo backend. */
export async function getMe(): Promise<SaxoUser> {
  const user = await apiCall<SaxoUser>('/auth/me');
  TokenStore.setUser(user);
  return user;
}

/** Verify a JWT token passed via URL (e.g. from Saxo dashboard redirect). */
export async function verifyTokenAndGetUser(token: string): Promise<SaxoUser> {
  TokenStore.set(token);
  return await getMe();
}

/** Returns true if a valid JWT is stored. */
export function isAuthenticated(): boolean {
  return !!TokenStore.get();
}

/** Clear session — logout. */
export function logout() {
  TokenStore.clear();
}

// ── Trading ──────────────────────────────────────────────────────────────

/**
 * Execute a real trade on the Saxo backend.
 * This persists to MongoDB and adjusts the user's real buying power.
 * @param symbol  e.g. "BTC", "AAPL", "ETH"
 * @param amountUSD  dollar amount to trade
 * @param type  'buy' | 'sell'
 */
export async function executeTrade(
  symbol: string,
  amountUSD: number,
  type: 'buy' | 'sell'
): Promise<TradeResult> {
  // Normalize symbol: strip USDT suffix for Saxo (BTC, not BTCUSDT)
  const cleanSymbol = symbol.replace('USDT', '').replace('-USD', '');
  return await apiCall<TradeResult>('/trade', {
    method: 'POST',
    body: JSON.stringify({ symbol: cleanSymbol, amountUSD, type, isMarginTrade: true }),
  });
}

/** Close a position on the Saxo backend. */
export async function closePositionOnBackend(
  symbol: string
): Promise<{ message: string; remainingBuyingPower?: number }> {
  const cleanSymbol = symbol.replace('USDT', '').replace('-USD', '');
  return await apiCall<{ message: string; remainingBuyingPower?: number }>('/trade/close', {
    method: 'POST',
    body: JSON.stringify({ symbol: cleanSymbol }),
  });
}

// ── Portfolio ─────────────────────────────────────────────────────────────

/** Fetch user's current real holdings from Saxo backend. */
export async function getHoldings(): Promise<SaxoHolding[]> {
  return await apiCall<SaxoHolding[]>('/trade/holdings');
}

/** Fetch portfolio performance summary. */
export async function getPortfolioSummary(): Promise<{
  totalValue: number;
  totalCost: number;
  totalProfitLoss: number;
  profitLossPercent: number;
  holdingsCount: number;
}> {
  return await apiCall('/trade/performance');
}

// ── Transactions ──────────────────────────────────────────────────────────

/** Fetch recent transaction history. */
export async function getTransactions(limit = 20): Promise<SaxoTransaction[]> {
  return await apiCall<SaxoTransaction[]>(`/transactions/recent?limit=${limit}`);
}

// ── User ─────────────────────────────────────────────────────────────────

/** Get the user's full profile including buyingPower. */
export async function getUserProfile(): Promise<SaxoUser> {
  return await apiCall<SaxoUser>('/user/profile');
}

/** Request a deposit. */
export async function requestDeposit(amount: number, method: string): Promise<{ message: string }> {
  return await apiCall('/user/deposit', {
    method: 'POST',
    body: JSON.stringify({ amount, method }),
  });
}

/** Request a withdrawal. */
export async function requestWithdrawal(amount: number, method: string): Promise<{ message: string }> {
  return await apiCall('/user/withdraw-request', {
    method: 'POST',
    body: JSON.stringify({ amount, method, methodName: method }),
  });
}

// ── Health check ──────────────────────────────────────────────────────────

/** Check if Saxo backend is reachable. */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Synchronize simulated price of an asset from LEAF terminal to Saxo backend database watchlists in real-time.
 */
export async function syncAssetPrice(
  symbol: string,
  price: number,
  changePercent: number
): Promise<any> {
  const cleanSymbol = symbol.replace('USDT', '').replace('-USD', '').toUpperCase();
  return await apiCall('/watchlist/update-price', {
    method: 'POST',
    body: JSON.stringify({ symbol: cleanSymbol, price, changePercent }),
  });
}
