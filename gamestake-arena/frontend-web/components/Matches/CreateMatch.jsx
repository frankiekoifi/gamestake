// src/components/Matches/CreateMatch.jsx
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import { toast } from 'react-toastify';

const GAMES = [
  'FIFA 24',
  'Call of Duty',
  'NBA 2K24',
  'Madden NFL 24',
  'Street Fighter 6',
  'Mortal Kombat 1'
];

export const CreateMatch = ({ onSuccess }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    game: '',
    wagerAmount: '',
    rules: {
      rounds: 1,
      timeLimit: 30,
      customRules: ''
    }
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.wagerAmount < 50) {
      toast.error('Minimum wager is KES 50');
      return;
    }

    setLoading(true);
    
    try {
      const response = await api.post('/matches/create', formData);
      toast.success('Challenge created successfully!');
      onSuccess?.(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create challenge');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Create Challenge</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Game
          </label>
          <select
            value={formData.game}
            onChange={(e) => setFormData({ ...formData, game: e.target.value })}
            className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Choose a game</option>
            {GAMES.map(game => (
              <option key={game} value={game}>{game}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Wager Amount (KES)
          </label>
          <input
            type="number"
            value={formData.wagerAmount}
            onChange={(e) => setFormData({ ...formData, wagerAmount: e.target.value })}
            min="50"
            max="100000"
            className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-sm text-gray-500 mt-1">Min: KES 50 | Max: KES 100,000</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Number of Rounds
          </label>
          <input
            type="number"
            value={formData.rules.rounds}
            onChange={(e) => setFormData({
              ...formData,
              rules: { ...formData.rules, rounds: parseInt(e.target.value) }
            })}
            min="1"
            max="5"
            className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
            Time Limit (minutes)
          </label>
          <input
            type="number"
            value={formData.rules.timeLimit}
            onChange={(e) => setFormData({
              ...formData,
              rules: { ...formData.rules, timeLimit: parseInt(e.target.value) }
            })}
            min="5"
            max="120"
            className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Rules (Optional)
          </label>
          <textarea
            value={formData.rules.customRules}
            onChange={(e) => setFormData({
              ...formData,
              rules: { ...formData.rules, customRules: e.target.value }
            })}
            rows="3"
            className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            placeholder="Any additional rules or conditions..."
          />
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800">
            Platform fee: {process.env.REACT_APP_PLATFORM_FEE || 10}% (deducted from winnings)
          </p>
          <p className="text-sm text-blue-800 mt-1">
            Winner receives: KES {(formData.wagerAmount * 2 * (1 - (process.env.REACT_APP_PLATFORM_FEE || 10) / 100)).toFixed(2)}
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Creating...' : 'Create Challenge'}
        </button>
      </form>
    </div>
  );
};