import { configureStore } from '@reduxjs/toolkit';
import { uiSlice } from './slices/ui.slice';
import { companyApi } from '../services/api/companyApi';
import { ordersApi } from '../services/api/ordersApi';
import { setupListeners } from '@reduxjs/toolkit/query';
import authReducer from './slices/auth.slice';

export const store = configureStore({
  reducer: {
    ui: uiSlice.reducer,
    companyApi: companyApi.reducer,
    ordersApi: ordersApi.reducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'persist/REGISTER',
        ],
      },
    }).concat(companyApi.middleware, ordersApi.middleware),
});

// Enable refetchOnFocus/RefetchOnReconnect behavior
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;