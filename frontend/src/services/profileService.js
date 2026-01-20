import { supabase } from '../config/supabase';
import { toast } from 'react-toastify';

// Get current user's profile
export const getProfile = async (userId) => {
  try {
    // This uses the secure view we'll create in Supabase
    const { data, error } = await supabase
      .from('user_profile')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error in getProfile:', error);
    toast.error('Failed to load profile');
    return { data: null, error: error.message || 'Unknown error occurred' };
  }
};

// Update profile (only allowed fields)
export const updateProfile = async (userId, updates) => {
  const allowedFields = ['full_name', 'phone', 'avatar_url'];
  const safeUpdates = {};
  
  // Filter only allowed fields
  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      safeUpdates[key] = updates[key];
    }
  });

  if (Object.keys(safeUpdates).length === 0) {
    return { data: null, error: new Error('No valid fields to update') };
  }

  try {
    const { data, error } = await supabase
      .from('officers')
      .update(safeUpdates)
      .eq('id', userId)
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error in updateProfile:', error);
    toast.error(error.message || 'Failed to update profile');
    return { data: null, error: error.message || 'Unknown error occurred' };
  }
};
