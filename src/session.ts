import { createContext, useContext } from 'react';
import type { User } from './api';

export const UserCtx = createContext<User>(null!);
export const useUser = () => useContext(UserCtx);
export const canEdit = (u: User) => u.role !== 'viewer';
