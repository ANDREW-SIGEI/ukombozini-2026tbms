import { toast } from 'react-toastify';

export const getProfile = async (userId) => {
  return {
    data: {
      id: userId,
      full_name: 'Administrator',
      role: 'admin'
    },
    error: null
  };
};

export const updateProfile = async (userId, updates) => {
  return { data: updates, error: null };
};
