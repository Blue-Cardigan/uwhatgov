import { useState, useCallback, useRef, useEffect } from 'react';

interface CacheConfig<_T> {
  keyPrefix: string;
  memoryCache?: boolean;
  localStorageCache?: boolean;
}

interface CacheState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

export function useDataCache<T>(config: CacheConfig<T>) {
  const [cache, setCache] = useState<Record<string, CacheState<T>>>({});
  const memoryCache = useRef<Map<string, T>>(new Map());
  const activeFetches = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  const getCacheKey = useCallback((id: string) => `${config.keyPrefix}${id}`, [config.keyPrefix]);

  // Initialize cache from localStorage on mount
  useEffect(() => {
    if (!config.localStorageCache || initialized.current) return;
    
    initialized.current = true;
    const initialCache: Record<string, CacheState<T>> = {};
    
    try {
      // Scan localStorage for items with our prefix
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(config.keyPrefix)) {
          const id = key.replace(config.keyPrefix, '');
          const storedData = localStorage.getItem(key);
          if (storedData) {
            try {
              const parsedData: T = JSON.parse(storedData);
              initialCache[id] = { data: parsedData, isLoading: false, error: null };
              
              // Also populate memory cache if enabled
              if (config.memoryCache) {
                memoryCache.current.set(id, parsedData);
              }
            } catch (parseError) {
              console.error(`[Cache] Error parsing localStorage item ${key}:`, parseError);
              localStorage.removeItem(key); // Remove corrupted item
            }
          }
        }
      }
      
      if (Object.keys(initialCache).length > 0) {
        setCache(initialCache);
        console.log(`[Cache] Initialized ${Object.keys(initialCache).length} items from localStorage with prefix ${config.keyPrefix}`);
      }
    } catch (error) {
      console.error(`[Cache] Error initializing from localStorage:`, error);
    }
  }, [config.keyPrefix, config.localStorageCache, config.memoryCache]);

  const getCachedData = useCallback((id: string): CacheState<T> => {
    if (!id) return { data: null, isLoading: false, error: null };
    
    // Return existing cache state if available
    if (cache[id]) {
      return cache[id];
    }

    // Check memory cache first (without triggering state updates)
    if (config.memoryCache && memoryCache.current.has(id)) {
      const data = memoryCache.current.get(id)!;
      return { data, isLoading: false, error: null };
    }

    // Check localStorage (without triggering state updates) 
    if (config.localStorageCache) {
      try {
        const cacheKey = getCacheKey(id);
        const storedData = localStorage.getItem(cacheKey);
        if (storedData) {
          const parsedData: T = JSON.parse(storedData);
          // Update memory cache but don't trigger re-render here
          if (config.memoryCache) {
            memoryCache.current.set(id, parsedData);
          }
          return { data: parsedData, isLoading: false, error: null };
        }
      } catch (error) {
        console.error(`[Cache] Error reading localStorage for ${id}:`, error);
      }
    }

    // Return default state for uncached items
    return { data: null, isLoading: false, error: null };
  }, [cache, config, getCacheKey]);

  const fetchData = useCallback(async (
    id: string,
    fetcher: (id: string) => Promise<T>
  ): Promise<T | null> => {
    if (!id) return null;

    // Check if we already have valid data
    const currentState = getCachedData(id);
    if (currentState.data && !currentState.error) {
      return currentState.data;
    }

    // Prevent concurrent fetches
    if (activeFetches.current.has(id)) {
      console.log(`[Cache] Fetch already in progress for ${id}`);
      return null;
    }

    // Fetch from API
    console.log(`[Cache] MISS. Fetching ${id} from API`);
    activeFetches.current.add(id);
    
    // Only update state if we're actually fetching
    setCache(prev => ({
      ...prev,
      [id]: { data: prev[id]?.data || null, isLoading: true, error: null }
    }));

    try {
      const data = await fetcher(id);
      
      // Store in memory cache
      if (config.memoryCache) {
        memoryCache.current.set(id, data);
      }
      
      // Store in localStorage
      if (config.localStorageCache) {
        try {
          const cacheKey = getCacheKey(id);
          localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (error) {
          console.error(`[Cache] Error writing localStorage for ${id}:`, error);
        }
      }
      
      setCache(prev => ({
        ...prev,
        [id]: { data, isLoading: false, error: null }
      }));
      
      return data;
    } catch (error: any) {
      console.error(`[Cache] Failed to fetch ${id}:`, error);
      
      setCache(prev => ({
        ...prev,
        [id]: { data: prev[id]?.data || null, isLoading: false, error: error.message || 'Failed to fetch' }
      }));
      
      return null;
    } finally {
      activeFetches.current.delete(id);
    }
  }, [config, getCacheKey, getCachedData]);

  const clearCache = useCallback((id?: string) => {
    if (id) {
      // Clear specific item
      const cacheKey = getCacheKey(id);
      if (config.memoryCache) {
        memoryCache.current.delete(id);
      }
      if (config.localStorageCache) {
        try {
          localStorage.removeItem(cacheKey);
        } catch (error) {
          console.error(`[Cache] Error removing localStorage for ${id}:`, error);
        }
      }
      setCache(prev => {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      });
    } else {
      // Clear all
      if (config.memoryCache) {
        memoryCache.current.clear();
      }
      setCache({});
    }
  }, [config, getCacheKey]);

  return {
    fetchData,
    getCachedData,
    clearCache,
    cache // Expose full cache for components that need it
  };
} 