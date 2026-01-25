import { toast } from 'react-toastify';

export const getProfile = async (userId) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  return {
    data: {
      id: userId,
      full_name: 'Administrator',
      role: 'admin',
      phone: '0722 000 000',
      member_since: '2024-01-15T09:00:00Z',
      avatar_url: null,
      permissions: ['manage_members', 'approve_loans', 'view_reports', 'manage_finance']
    },
    error: null
  };
};

export const updateProfile = async (userId, updates) => {
  return { data: updates, error: null };
};
