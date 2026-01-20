import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getProfile, updateProfile } from '../services/profileService';
import { toast } from 'react-toastify';
import { FaUser, FaShieldAlt, FaHistory, FaCheck, FaTimes } from 'react-icons/fa';

const ProfilePage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    avatar: null
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;
      
      setIsLoading(true);
      const { data, error } = await getProfile(user.id);
      
      if (data) {
        setProfile(data);
        setFormData({
          full_name: data.full_name || '',
          phone: data.phone || '',
          avatar: data.avatar_url || null
        });
      } else if (error) {
        toast.error('Failed to load profile');
      }
      
      setIsLoading(false);
    };
    
    loadProfile();
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.id) return;
    
    try {
      const { data, error } = await updateProfile(user.id, formData);
      
      if (error) throw error;
      
      setProfile(prev => ({
        ...prev,
        ...data
      }));
      
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update profile');
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="text-center py-10">Profile not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-safaricom-green to-safaricom-dark p-6 text-white">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
                {getInitials(profile.full_name || user.email)}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{profile.full_name || 'User'}</h1>
                <p className="text-blue-100">{user.email}</p>
                <div className="mt-2">
                  <span className="inline-block bg-blue-100 text-safaricom-dark text-xs px-2 py-1 rounded-full font-medium">
                    {profile.role || 'Member'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-sm text-blue-100">
              <div className="flex items-center gap-2">
                <FaShieldAlt className="inline" />
                <span>ID: {user.id.substring(0, 8)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-block w-2 h-2 rounded-full ${profile.active ? 'bg-green-400' : 'bg-red-400'}`}></span>
                <span>{profile.active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Profile Information</h2>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 bg-safaricom-green hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-safaricom-green focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-safaricom-green focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Profile Photo</label>
                  <div className="mt-1 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                      {formData.avatar ? (
                        <img src={formData.avatar} alt="Profile" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <FaUser className="text-gray-400 text-2xl" />
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFormData(prev => ({
                                ...prev,
                                avatar: reader.result
                              }));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="text-sm text-gray-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">JPG, GIF or PNG. Max size 2MB</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-safaricom-green hover:bg-green-700 text-white rounded-lg font-medium"
                >
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Full Name</h3>
                  <p className="mt-1 text-gray-900">{profile.full_name || 'Not provided'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Email</h3>
                  <p className="mt-1 text-gray-900">{user.email}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Phone</h3>
                  <p className="mt-1 text-gray-900">{profile.phone || 'Not provided'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Member Since</h3>
                  <p className="mt-1 text-gray-900">
                    {new Date(profile.member_since).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              {/* Permissions Section */}
              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Permissions</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-3">
                    Your role <span className="font-medium">{profile.role}</span> has the following permissions:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {profile.permissions?.length > 0 ? (
                      profile.permissions.map((permission, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <FaCheck className="text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700">
                            {formatPermissionLabel(permission)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500">No specific permissions assigned</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Account Status */}
              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${profile.active ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {profile.active ? <FaCheck /> : <FaTimes />}
                      </div>
                      <div>
                        <h4 className="font-medium">Account Status</h4>
                        <p className="text-sm text-gray-500">
                          {profile.active ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {profile.active ? 'Your account is active' : 'Your account is inactive'}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                        <FaHistory />
                      </div>
                      <div>
                        <h4 className="font-medium">Last Login</h4>
                        <p className="text-sm text-gray-500">
                          {profile.last_sign_in_at 
                            ? new Date(profile.last_sign_in_at).toLocaleString()
                            : 'Never logged in'}
                        </p>
                      </div>
                    </div>
                    <button 
                      className="text-sm text-safaricom-green hover:underline"
                      onClick={() => {
                        // TODO: Implement session management view
                        toast.info('Session management coming soon');
                      }}
                    >
                      View Sessions
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function to format permission keys into readable text
function formatPermissionLabel(permission) {
  return permission
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default ProfilePage;
