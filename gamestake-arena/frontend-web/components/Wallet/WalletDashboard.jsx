// src/components/Wallet/WalletDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import { DepositModal } from './DepositModal';
import { WithdrawModal } from './WithdrawModal';
import { TransactionHistory } from './TransactionHistory';
import { toast } from 'react-toastify';

export const WalletDashboard = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    try {
      const response = await api.get('/wallet/balance');
      setWallet(response.data);
    } catch (error) {
      toast.error('Failed to load wallet');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h1 className="text-2xl font-bold mb-4">Wallet Balance</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Available Balance</p>
            <p className="text-2xl font-bold text-green-600">
              KES {wallet?.balance?.toLocaleString()}
            </p>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Pending Balance</p>
            <p className="text-2xl font-bold text-yellow-600">
              KES {wallet?.pendingBalance?.toLocaleString()}
            </p>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Locked in Matches</p>
            <p className="text-2xl font-bold text-blue-600">
              KES {wallet?.lockedBalance?.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex space-x-4 mt-6">
          <button
            onClick={() => setShowDeposit(true)}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
          >
            Deposit
          </button>
          <button
            onClick={() => setShowWithdraw(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Withdraw
          </button>
        </div>
      </div>

      <TransactionHistory />

      {showDeposit && (
        <DepositModal
          onClose={() => setShowDeposit(false)}
          onSuccess={fetchWallet}
        />
      )}

      {showWithdraw && (
        <WithdrawModal
          onClose={() => setShowWithdraw(false)}
          onSuccess={fetchWallet}
          maxAmount={wallet?.balance}
        />
      )}
    </div>
  );
};