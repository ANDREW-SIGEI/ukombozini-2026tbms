import api from './api';


export const getProfile = async (userId) => {
  try {
    // Backend API call via api service
    const data = await api.getProfile(userId);
    return { data, error: null };
  } catch (error) {
    console.error("Fetch Profile Error:", error);
    return {
      data: null,
      error: error.response?.data?.error || "Failed to load profile data"
    };
  }
};

export const updateProfile = async (userId, updates) => {
  try {
    const data = await api.updateProfile(updates);
    return { data, error: null };
  } catch (error) {
    console.error("Update Profile Error:", error);
    return {
      data: null,
      error: error.response?.data?.error || "Failed to update profile"
    };
  }
};
