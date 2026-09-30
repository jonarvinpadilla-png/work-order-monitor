import { createContext, useContext } from 'react';

// The signed-in session and how to end it, for any screen that needs it.
export const SessionContext = createContext({ session: null, signOut: () => {} });
export const useSession = () => useContext(SessionContext);
