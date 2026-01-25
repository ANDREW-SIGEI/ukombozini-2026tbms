import api from './api';
import { toast } from 'react-toastify';

export const getProfile = async (userId) => {
  try {
    // If no userId, backend defaults to Admin. 
    // Ideally we pass authentication tokens which the backend reads.
    const response = await api.get(`/profile${userId ? `?id=${userId}` : ''}`);
    return { data: response.data, error: null };
  } catch (error) {
    console.error("Fetch Profile Error:", error);
    return {
      data: null,
      error: error.response?.data?.error || "Failed to load profile data"
    };
  }
};

export const updateProfile = async (userId, updates) => {
  // TODO: Implement backend endpoint for profile updates (PUT /api/officers/:id)
  // For now, allow frontend simulation to succeed
  console.log("Updating Profile:", userId, updates);
  await new Promise(resolve => setTimeout(resolve, 500));
  return { data: updates, error: null };
};
