import React from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  allowedRoles,
  children,
  fallback = null,
}) => {
  const { currentUser } = useApp();

  if (!currentUser) return <>{fallback}</>;

  // Developer always bypasses all checks
  if (currentUser.role === 'developer') {
    return <>{children}</>;
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
