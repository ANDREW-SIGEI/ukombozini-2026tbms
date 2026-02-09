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
    placeholder = "Choose Active Group..."
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
            {label && <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{label}</label>}

            <div
                onClick={() => !disabled && setShowDropdown(!showDropdown)}
                className={`flex items-center gap-4 bg-gray-50 rounded-xl px-4 py-2 border transition-all cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'hover:border-safaricom-green focus-within:ring-2 focus-within:ring-safaricom-green/10'
                    } ${showDropdown ? 'border-safaricom-green ring-2 ring-safaricom-green/10' : 'border-gray-200'}`}
            >
                <FaLayerGroup className="text-safaricom-green text-lg shrink-0" />
                <div className="flex-1 min-w-0 flex justify-between items-center">
                    <span className={`truncate font-bold text-sm ${selectedGroup ? 'text-gray-900' : 'text-gray-400'}`}>
                        {selectedGroup ? (selectedGroup.group_name || selectedGroup.name) : placeholder}
                    </span>
                    <FaSearch className="text-gray-300 text-xs shrink-0 ml-2" />
                </div>
            </div>

            {showDropdown && !disabled && (
                <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-3 border-b border-gray-50 bg-gray-50/50">
                        <div className="relative">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs" />
                            <input
                                type="text"
                                autoFocus
                                placeholder="Search groups..."
                                className="w-full bg-white border border-gray-100 rounded-lg pl-9 pr-3 py-2 text-xs font-bold text-gray-800 focus:ring-2 focus:ring-safaricom-green/10 focus:border-safaricom-green outline-none transition-all shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                        {filteredGroups.length > 0 ? (
                            filteredGroups.map(g => (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => {
                                        onSelect(g.id);
                                        setShowDropdown(false);
                                        setSearchTerm('');
                                    }}
                                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200 text-left ${selectedGroupId !== '' && selectedGroupId == g.id
                                            ? 'bg-safaricom-green text-white shadow-md'
                                            : 'hover:bg-gray-50 text-gray-700'
                                        }`}
                                >
                                    <span className="font-bold text-xs uppercase truncate pr-4">
                                        {g.group_name || g.name}
                                    </span>
                                    {selectedGroupId !== '' && selectedGroupId == g.id && <FaCheckCircle className="text-white shrink-0" />}
                                </button>
                            ))
                        ) : (
                            <div className="p-8 text-center">
                                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest leading-loose">
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
