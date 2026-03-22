import React from 'react';

export const useAuth = jest.fn(() => ({
  isSignedIn: false,
  userId: null,
  isLoaded: true,
  getToken: jest.fn().mockResolvedValue(null),
}));

export const useUser = jest.fn(() => ({
  user: null,
  isLoaded: true,
}));

export const useClerk = jest.fn(() => ({
  signOut: jest.fn(),
  openSignIn: jest.fn(),
}));

export const ClerkProvider = ({ children }: { children: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

export const SignedIn = ({ children }: { children: React.ReactNode }) => {
  const { isSignedIn } = useAuth();
  return isSignedIn ? React.createElement(React.Fragment, null, children) : null;
};

export const SignedOut = ({ children }: { children: React.ReactNode }) => {
  const { isSignedIn } = useAuth();
  return !isSignedIn ? React.createElement(React.Fragment, null, children) : null;
};

export const RedirectToSignIn = () => React.createElement('div', null, 'Sign In Required');

export const SignIn = () => React.createElement('div', { 'data-testid': 'clerk-sign-in' }, 'Sign In');
export const UserButton = () => React.createElement('div', { 'data-testid': 'user-button' }, 'User Button');
