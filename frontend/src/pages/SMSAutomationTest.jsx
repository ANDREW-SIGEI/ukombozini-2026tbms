import React, { useState } from 'react';
import { FaPaperPlane, FaCheckCircle, FaTimesCircle, FaBell, FaUsers, FaCalendarAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import AutomatedReminderService, { SMS_TEMPLATES } from '../services/AutomatedReminderService';
import { mockMembers } from '../data/mockData';

const SMSAutomationTest = () => {
    const [selectedTemplate, setSelectedTemplate] = useState('CONTRIBUTION_REMINDER');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [customMessage, setCustomMessage] = useState('');
    const [testPhone, setTestPhone] = useState('');
    const [sendingStatus, setSendingStatus] = useState(null);
    const [results, setResults] = useState([]);

    const reminderService = new AutomatedReminderService();

    // Test single SMS
    const handleSendTestSMS = async () => {
        if (!testPhone) {
            toast.error('Please enter a phone number');
            return;
        }

        setSendingStatus('sending');

        try {
            const template = SMS_TEMPLATES[selectedTemplate];
            const message = template.message
                .replace('{{name}}', 'Test User')
                .replace('{{month}}', new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' }))
                .replace('{{amount}}', '2,000')
                .replace('{{date}}', new Date().toLocaleDateString('en-GB'));

            await reminderService.smsService.sendSMS(testPhone, message);

            toast.success('✅ Test SMS sent successfully!');
            setSendingStatus('success');
            setResults([{
                type: 'Test SMS',
                phone: testPhone,
                template: selectedTemplate,
                status: 'Sent',
                timestamp: new Date().toLocaleString()
            }, ...results]);
        } catch (error) {
            toast.error(`❌ Failed to send: ${error.message}`);
            setSendingStatus('error');
            setResults([{
                type: 'Test SMS',
                phone: testPhone,
                template: selectedTemplate,
                status: 'Failed',
                error: error.message,
                timestamp: new Date().toLocaleString()
            }, ...results]);
        }
    };

    // Send contribution reminders
    const handleSendContributionReminders = async () => {
        setSendingStatus('sending');

        try {
            const unpaidMembers = mockMembers.slice(0, 3); // Test with first 3 members
            const result = await reminderService.sendMonthlyContributionReminders(
                unpaidMembers,
                new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })
            );

            toast.success(`✅ Sent ${result.totalSent} reminders, ${result.totalFailed} failed`);
            setSendingStatus('success');
            setResults([{
                type: 'Contribution Reminders',
                totalSent: result.totalSent,
                totalFailed: result.totalFailed,
                details: result.details,
                timestamp: new Date().toLocaleString()
            }, ...results]);
        } catch (error) {
            toast.error(`❌ Failed: ${error.message}`);
            setSendingStatus('error');
        }
    };

    // Send loan reminders
    const handleSendLoanReminders = async () => {
        setSendingStatus('sending');

        try {
            const mockLoans = [
                {
                    id: 'L-001',
                    memberId: 1,
                    memberName: 'Hilda Sigei',
                    memberPhone: '+254712345678',
                    monthlyRepayment: 2000,
                    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                    remainingBalance: 14000,
                    status: 'Active'
                }
            ];

            const result = await reminderService.sendLoanRepaymentReminders(mockLoans, 3);

            toast.success(`✅ Sent ${result.totalSent} loan reminders`);
            setSendingStatus('success');
            setResults([{
                type: 'Loan Reminders',
                totalSent: result.totalSent,
                totalFailed: result.totalFailed,
                details: result.details,
                timestamp: new Date().toLocaleString()
            }, ...results]);
        } catch (error) {
            toast.error(`❌ Failed: ${error.message}`);
            setSendingStatus('error');
        }
    };

    // Send meeting notification
    const handleSendMeetingNotification = async () => {
        setSendingStatus('sending');

        try {
            const testMembers = mockMembers.slice(0, 2);
            const meetingDetails = {
                groupName: 'Ukombozi Group A',
                sessionNumber: 14,
                date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                time: '2:00 PM',
                venue: 'Community Hall'
            };

            const result = await reminderService.sendMeetingNotification(testMembers, meetingDetails);

            toast.success(`✅ Sent ${result.totalSent} meeting notifications`);
            setSendingStatus('success');
            setResults([{
                type: 'Meeting Notifications',
                totalSent: result.totalSent,
                totalFailed: result.totalFailed,
                details: result.details,
                timestamp: new Date().toLocaleString()
            }, ...results]);
        } catch (error) {
            toast.error(`❌ Failed: ${error.message}`);
            setSendingStatus('error');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-safaricom-green to-green-600 p-6 rounded-2xl text-white">
                <h2 className="text-2xl font-black flex items-center gap-3">
                    <FaPaperPlane />
                    SMS Automation Testing
                </h2>
                <p className="text-sm opacity-90 mt-2">
                    Test automated SMS reminders and notifications with AfricasTalking
                </p>
            </div>

            {/* Configuration Status */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2">
                    <FaCheckCircle className="text-safaricom-green" />
                    Configuration Status
                </h3>

                <div className="space-y-3">
                    <ConfigStatus
                        label="SMS Service"
                        status={process.env.REACT_APP_SMS_API_KEY ? 'configured' : 'pending'}
                        details={process.env.REACT_APP_SMS_API_KEY ? 'AfricasTalking API key found' : 'API key not configured'}
                    />
                    <ConfigStatus
                        label="SMS Username"
                        status={process.env.REACT_APP_SMS_USERNAME ? 'configured' : 'pending'}
                        details={process.env.REACT_APP_SMS_USERNAME || 'Username not configured'}
                    />
                    <ConfigStatus
                        label="AutomatedReminderService"
                        status="configured"
                        details="Service initialized and ready"
                    />
                </div>

                {(!process.env.REACT_APP_SMS_API_KEY || !process.env.REACT_APP_SMS_USERNAME) && (
                    <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-xl">
                        <p className="text-sm text-yellow-800 font-bold">
                            ⚠️ SMS credentials not configured. Add to .env file:
                        </p>
                        <pre className="text-xs mt-2 bg-yellow-100 p-2 rounded">
                            {`REACT_APP_SMS_API_KEY=your-api-key
REACT_APP_SMS_USERNAME=sandbox`}
                        </pre>
                    </div>
                )}
            </div>

            {/* Test Single SMS */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-black text-gray-800 mb-4">1. Test Single SMS</h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                            Select Template
                        </label>
                        <select
                            value={selectedTemplate}
                            onChange={(e) => setSelectedTemplate(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-safaricom-green/20 outline-none"
                        >
                            {Object.entries(SMS_TEMPLATES).map(([key, template]) => (
                                <option key={key} value={key}>{template.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                            Test Phone Number (with country code)
                        </label>
                        <input
                            type="tel"
                            placeholder="+254712345678"
                            value={testPhone}
                            onChange={(e) => setTestPhone(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-safaricom-green/20 outline-none"
                        />
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl">
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Message Preview:</div>
                        <div className="text-sm whitespace-pre-line">
                            {SMS_TEMPLATES[selectedTemplate].message
                                .replace('{{name}}', 'Test User')
                                .replace('{{month}}', new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' }))
                                .replace('{{amount}}', '2,000')
                                .replace('{{date}}', new Date().toLocaleDateString('en-GB'))
                            }
                        </div>
                    </div>

                    <button
                        onClick={handleSendTestSMS}
                        disabled={sendingStatus === 'sending'}
                        className="w-full py-4 bg-safaricom-green text-white rounded-xl font-black hover:bg-safaricom-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <FaPaperPlane />
                        {sendingStatus === 'sending' ? 'Sending...' : 'Send Test SMS'}
                    </button>
                </div>
            </div>

            {/* Bulk Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ActionCard
                    icon={<FaBell />}
                    title="Contribution Reminders"
                    description="Send to 3 test members"
                    onClick={handleSendContributionReminders}
                    disabled={sendingStatus === 'sending'}
                    color="blue"
                />
                <ActionCard
                    icon={<FaUsers />}
                    title="Loan Reminders"
                    description="Test loan repayment alerts"
                    onClick={handleSendLoanReminders}
                    disabled={sendingStatus === 'sending'}
                    color="purple"
                />
                <ActionCard
                    icon={<FaCalendarAlt />}
                    title="Meeting Notification"
                    description="Send to 2 test members"
                    onClick={handleSendMeetingNotification}
                    disabled={sendingStatus === 'sending'}
                    color="orange"
                />
            </div>

            {/* Results */}
            {results.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="font-black text-gray-800 mb-4">Test Results</h3>

                    <div className="space-y-3">
                        {results.map((result, index) => (
                            <div key={index} className="bg-gray-50 p-4 rounded-xl border-l-4 border-safaricom-green">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="font-bold text-gray-900">{result.type}</div>
                                        <div className="text-xs text-gray-500">{result.timestamp}</div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${result.status === 'Sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                        {result.status || 'Completed'}
                                    </div>
                                </div>

                                {result.totalSent !== undefined && (
                                    <div className="text-sm">
                                        <span className="text-green-600 font-bold">✓ Sent: {result.totalSent}</span>
                                        {result.totalFailed > 0 && (
                                            <span className="ml-3 text-red-600 font-bold">✗ Failed: {result.totalFailed}</span>
                                        )}
                                    </div>
                                )}

                                {result.phone && (
                                    <div className="text-sm text-gray-600">To: {result.phone}</div>
                                )}

                                {result.error && (
                                    <div className="text-xs text-red-600 mt-2">Error: {result.error}</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Setup Instructions */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-xl">
                <h4 className="font-black text-blue-900 mb-3">📘 Setup Instructions</h4>
                <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                    <li>Go to <a href="https://account.africastalking.com/auth/register" target="_blank" rel="noopener noreferrer" className="underline font-bold">AfricasTalking</a> and create account</li>
                    <li>Use "sandbox" username for testing (free credits provided)</li>
                    <li>Get your API key from Dashboard → API Key</li>
                    <li>Add credentials to <code className="bg-blue-100 px-2 py-1 rounded">.env</code> file</li>
                    <li>Restart development server</li>
                    <li>Test with your phone number (must be added to sandbox)</li>
                </ol>
            </div>
        </div>
    );
};

// Helper Components
const ConfigStatus = ({ label, status, details }) => (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div>
            <div className="font-bold text-sm text-gray-900">{label}</div>
            <div className="text-xs text-gray-500">{details}</div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold ${status === 'configured' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
            {status === 'configured' ? '✓ Ready' : '⚠ Pending'}
        </div>
    </div>
);

const ActionCard = ({ icon, title, description, onClick, disabled, color }) => {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        purple: 'from-purple-500 to-purple-600',
        orange: 'from-orange-500 to-orange-600'
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`p-6 bg-gradient-to-br ${colors[color]} text-white rounded-2xl text-left hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            <div className="text-3xl mb-3">{icon}</div>
            <div className="font-black text-lg mb-1">{title}</div>
            <div className="text-sm opacity-90">{description}</div>
        </button>
    );
};

export default SMSAutomationTest;
