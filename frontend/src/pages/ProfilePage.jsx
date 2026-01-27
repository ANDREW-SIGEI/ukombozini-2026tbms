import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getProfile, updateProfile } from '../services/profileService';
import { toast } from 'react-toastify';
import {
  FaUser, FaShieldHalved, FaClockRotateLeft, FaCheck, FaXmark, FaCamera,
  FaWallet, FaUsers, FaChartLine, FaCircleCheck, FaLock,
  FaBell, FaPenToSquare, FaArrowRightFromBracket, FaGem
} from 'react-icons/fa6';
import '../styles/ProfileStyles.css';
import { api } from '../services/api'; // Import API for metrics

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    avatar: null
  });
  const [isLoading, setIsLoading] = useState(true);

  // Metrics State
  const [metrics, setMetrics] = useState({
    managedAssets: "Loading...",
    portfolioQuality: "Loading...",
    activeMembers: "Loading...",
    meetingEfficiency: "Loading..."
  });

  const recentActivity = [
    { type: 'Post', text: 'Posted Group A weekly contributions', time: '2 hours ago' },
    { type: 'Approve', text: 'Approved loan for Alice Wanjiku', time: '5 hours ago' },
    { type: 'Update', text: 'Updated group meeting schedule', time: 'Yesterday' },
  ];

  useEffect(() => {
    const loadProfileAndMetrics = async () => {
      if (!user?.id) return;

      setIsLoading(true);
      try {
        const { data: profileData, error } = await getProfile(user.id);

        if (profileData) {
          setProfile(profileData);
          setFormData({
            full_name: profileData.full_name || '',
            phone: profileData.phone || '',
            avatar: profileData.avatar_url || null
          });

          // Fetch System Metrics (if admin/officer) or Group Metrics
          const [membersData, loansData] = await Promise.all([
            api.getMembers(), // We can use this to count members & calc savings
            api.getLoans()    // To calc assets
          ]);

          if (membersData && loansData) {
            const totalSavings = membersData.reduce((sum, m) => sum + (m.savings || 0), 0);
            const totalLoans = loansData.reduce((sum, l) => sum + Number(l.principal_amount), 0);
            const activeMembersCount = membersData.length;

            // Portfolio Quality (Simple proxy: Non-defaulted loans / Total loans)
            // Ideally backend gives this.

            setMetrics({
              managedAssets: `KES ${(totalSavings + totalLoans).toLocaleString()}`,
              portfolioQuality: "98.5%", // Placeholder until arrears calc is global
              activeMembers: `${activeMembersCount} Members`,
              meetingEfficiency: "100%"
            });
          }

        } else if (error) {
          toast.error('Failed to load profile');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfileAndMetrics();
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

      setProfile(prev => ({ ...prev, ...data }));
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update profile');
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
        <div className="w-12 h-12 border-4 border-safaricom-green border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-bold animate-pulse">INITIALIZING SECURE SESSION...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50 px-4">
        <div className="glass-card p-8 rounded-3xl text-center max-w-md">
          <FaXmark className="text-red-500 text-5xl mx-auto mb-4" />
          <h2 className="text-2xl font-black text-gray-800 mb-2">Security Access Denied</h2>
          <p className="text-gray-500 font-bold mb-6">We could not establish a connection to your profile data. Please ensure you are authorized.</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-safaricom-green text-white rounded-2xl font-black shadow-lg"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container container mx-auto px-4 py-8 max-w-6xl space-y-8">

      {/* 1. HERO HEADER */}
      <div className="hero-gradient rounded-3xl p-8 text-white relative shadow-2xl overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="profile-avatar-container">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center text-4xl font-black border-2 border-white/30 shadow-xl overflow-hidden group">
                {formData.avatar ? (
                  <img src={formData.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  getInitials(profile.full_name || user.email)
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <FaCamera />
                </div>
              </div>
              <div className="status-indicator status-online"></div>
            </div>
            <div className="text-center md:text-left space-y-2">
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                  {profile.full_name || 'System User'}
                </h1>
                <FaGem className="text-yellow-400 animate-bounce" />
              </div>
              <p className="text-blue-50 font-medium tracking-wide flex items-center gap-2 justify-center md:justify-start">
                <FaShieldHalved className="text-sm" />
                {user.email}
              </p>
              <div className="flex flex-wrap gap-2 pt-2 justify-center md:justify-start">
                <span className="badge-officer text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest flex items-center gap-1">
                  <FaUser /> {profile.role || 'Officer'}
                </span>
                <span className="bg-white/10 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest">
                  ID: #{String(user.id).padStart(4, '0')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 w-full md:w-auto">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center justify-center gap-2 bg-white text-safaricom-dark px-6 py-3 rounded-2xl font-black text-sm hover:bg-gray-100 transition-all shadow-lg active:scale-95"
            >
              {isEditing ? <FaXmark /> : <FaPenToSquare />} {isEditing ? 'Cancel Edit' : 'Edit Profile'}
            </button>
            <button
              onClick={logout}
              className="flex items-center justify-center gap-2 bg-red-500/20 backdrop-blur-md text-white border border-red-500/30 px-6 py-3 rounded-2xl font-black text-sm hover:bg-red-500/40 transition-all"
            >
              <FaArrowRightFromBracket /> Secure Logout
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT COLUMN: INFO & PERFORMANCE */}
        <div className="lg:col-span-2 space-y-8">

          {/* PERFORMANCE METRICS DASHBOARD */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Managed Assets', value: metrics.managedAssets, icon: <FaWallet />, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Recovery Rate', value: metrics.portfolioQuality, icon: <FaChartLine />, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Coverage', value: metrics.activeMembers, icon: <FaUsers />, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Efficiency', value: metrics.meetingEfficiency, icon: <FaCircleCheck />, color: 'text-orange-600', bg: 'bg-orange-50' },
            ].map((m, idx) => (
              <div key={idx} className="metric-card glass-card p-4 rounded-3xl space-y-2">
                <div className={`${m.bg} ${m.color} w-10 h-10 rounded-2xl flex items-center justify-center text-xl`}>
                  {m.icon}
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{m.label}</p>
                  <p className="text-lg font-black text-gray-800">{m.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* MAIN FORM / INFO CARD */}
          <div className="glass-card rounded-3xl p-8 border border-gray-100">
            <h2 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
              <FaUser className="text-safaricom-green" /> Profile Configuration
            </h2>

            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Full Identity</label>
                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      className="premium-input w-full px-4 py-3 rounded-2xl font-bold text-gray-700"
                      placeholder="Enter full name..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Secure Contact</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="premium-input w-full px-4 py-3 rounded-2xl font-bold text-gray-700"
                      placeholder="07XX XXX XXX"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-50">
                  <button
                    type="submit"
                    className="px-8 py-3 bg-safaricom-green text-white rounded-2xl font-black shadow-lg shadow-green-200 hover:bg-green-700 transition-all active:scale-95"
                  >
                    Protect & Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Full Name</h3>
                  <p className="text-lg font-black text-gray-800">{profile.full_name || '—'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Phone</h3>
                  <p className="text-lg font-black text-gray-800">{profile.phone || '—'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Registration</h3>
                  <p className="text-lg font-black text-gray-800">
                    {profile.member_since
                      ? new Date(profile.member_since).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                      : 'N/A'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SECURITY & PERMISSIONS */}
          <div className="glass-card rounded-3xl p-8">
            <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2 uppercase tracking-tight">
              <FaLock className="text-blue-500" /> Authorized Permissions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.permissions?.map((p, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100 group hover:border-blue-200 transition-all">
                  <div className="bg-white p-2 rounded-xl shadow-sm text-blue-500">
                    <FaCheck />
                  </div>
                  <span className="text-sm font-black text-gray-600 uppercase tracking-tight group-hover:text-gray-900">
                    {p.replace(/_/g, ' ')}
                  </span>
                </div>
              )) || <p className="text-gray-400 font-bold italic">No specialized permissions assigned.</p>}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVITY & SETTINGS */}
        <div className="space-y-8">

          {/* QUICK PREFERENCES */}
          <div className="glass-card rounded-3xl p-8 space-y-6">
            <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
              <FaBell className="text-orange-500" /> System Alerts
            </h3>
            <div className="space-y-4">
              {[
                { label: 'SMS Notifications', desc: 'Alerts for group payouts', enabled: true },
                { label: 'Fraud Detection', desc: 'Secure login warnings', enabled: true },
                { label: 'Weekly Summary', desc: 'Performance report email', enabled: false }
              ].map((pref, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black text-gray-700">{pref.label}</p>
                    <p className="text-[10px] text-gray-400 font-bold">{pref.desc}</p>
                  </div>
                  <div className={`w-12 h-6 rounded-full relative cursor-pointer transition-all ${pref.enabled ? 'bg-safaricom-green' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${pref.enabled ? 'right-1' : 'left-1'}`}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RECENT ACTIVITY TIMELINE */}
          <div className="glass-card rounded-3xl p-8">
            <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
              <FaClockRotateLeft className="text-purple-500" /> Activity Stream
            </h3>
            <div className="space-y-1">
              {recentActivity.map((act, i) => (
                <div key={i} className="timeline-item">
                  <p className="text-sm font-black text-gray-800 leading-tight">{act.text}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">{act.time}</p>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-[10px] font-black text-gray-400 hover:border-purple-300 hover:text-purple-500 transition-all uppercase tracking-widest">
              Load Audit Logs
            </button>
          </div>

        </div>
      </div>
    </div >
  );
};

export default ProfilePage;
