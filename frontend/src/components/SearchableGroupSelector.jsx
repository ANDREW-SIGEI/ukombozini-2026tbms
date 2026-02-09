import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FaSearch, FaLayerGroup, FaCheckCircle } from 'react-icons/fa';

/**
 * A reusable searchable dropdown for selecting a group.
 * @param {Array} groups - List of group objects.
 * @param {string|number} selectedGroupId - Current selected ID.
 * @param {function} onSelect - Callback when a group is chosen.
 * @param {boolean} disabled - Whether the selector is interactive.
 * @param {string} label - Input label.
 * @param {string} placeholder - Displayed when no group is selected.
 */
const SearchableGroupSelector = ({
    groups = [],
    selectedGroupId = "",
    onSelect,
    disabled = false,
    label = "Select Group",
    placeholder = "Search and Select Group..."
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    // Click outside listener
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredGroups = useMemo(() => {
        return (groups || []).filter(g =>
            (g.group_name || g.name || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [groups, searchTerm]);

    const selectedGroup = (groups || []).find(g => selectedGroupId !== '' && g.id == selectedGroupId);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            {label && (
                <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-tight">{label}</label>
                    {disabled && <span className="text-[9px] font-bold text-red-500 uppercase px-1.5 py-0.5 bg-red-50 rounded">Locked</span>}
                </div>
            )}

            <div
                onClick={() => !disabled && setShowDropdown(!showDropdown)}
                className={`flex items-center gap-4 bg-gray-50 rounded-xl px-4 py-3 border transition-all cursor-pointer shadow-sm ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'hover:border-safaricom-green focus-within:ring-2 focus-within:ring-safaricom-green/10'
                    } ${showDropdown ? 'border-safaricom-green ring-2 ring-safaricom-green/10' : 'border-gray-200'}`}
            >
                <div className="relative flex items-center gap-3 flex-1 min-w-0">
                    <FaSearch className={`text-lg shrink-0 ${showDropdown || selectedGroup ? 'text-safaricom-green' : 'text-gray-300'}`} />
                    <span className={`truncate font-black text-sm ${selectedGroup ? 'text-gray-900' : 'text-gray-400'}`}>
                        {selectedGroup ? (selectedGroup.group_name || selectedGroup.name) : placeholder}
                    </span>
                </div>
                {!disabled && (
                    <div className="shrink-0 w-6 h-6 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                        <div className={`transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}>
                            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                )}
            </div>

            {showDropdown && !disabled && (
                <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-gray-50 bg-gray-50/50">
                        <div className="relative group">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-safaricom-green text-sm group-focus-within:scale-110 transition-transform" />
                            <input
                                type="text"
                                autoFocus
                                placeholder="Type to search groups..."
                                className="w-full bg-white border-2 border-gray-100 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-gray-800 focus:ring-4 focus:ring-safaricom-green/10 focus:border-safaricom-green outline-none transition-all shadow-inner"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto p-2 custom-scrollbar">
                        {filteredGroups.length > 0 ? (
                            <div className="grid grid-cols-1 gap-1">
                                {filteredGroups.map(g => (
                                    <button
                                        key={g.id}
                                        type="button"
                                        onClick={() => {
                                            onSelect(g.id);
                                            setShowDropdown(false);
                                            setSearchTerm('');
                                        }}
                                        className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all duration-200 text-left group ${selectedGroupId !== '' && selectedGroupId == g.id
                                            ? 'bg-safaricom-green text-white shadow-lg'
                                            : 'hover:bg-green-50 text-gray-700'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <FaLayerGroup className={`text-lg shrink-0 ${selectedGroupId == g.id ? 'text-white' : 'text-gray-200 group-hover:text-safaricom-green'}`} />
                                            <span className="font-black text-[13px] uppercase truncate tracking-tight">
                                                {g.group_name || g.name}
                                            </span>
                                        </div>
                                        {selectedGroupId !== '' && selectedGroupId == g.id && <FaCheckCircle className="text-white shrink-0 ml-2" />}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="p-12 text-center">
                                <FaSearch className="text-gray-100 text-4xl mx-auto mb-3" />
                                <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest leading-loose">
                                    No Matches Identified
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableGroupSelector;
