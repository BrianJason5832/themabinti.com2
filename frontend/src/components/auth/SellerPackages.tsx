import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Star } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import axios from 'axios';
import { Input } from '@/components/ui/input';
import api from '@/config/api';
import { toast } from 'sonner';

const packages = [
  {
    id: 'basic',
    name: 'Basic',
    price: 800,
    recommended: false,
    features: [
      '1 Photo Upload',
      'Book Appointment Feature',
      'Basic Visibility',
      'Mabinti Community Access'
    ],
    photoUploads: 1,
    videoUploads: 0
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 1500,
    recommended: true,
    features: [
      '2 Photo Uploads',
      'Book Appointment Feature',
      'Enhanced Visibility',
      'Mabinti Community Access'
    ],
    photoUploads: 2,
    videoUploads: 0
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 2500,
    recommended: false,
    features: [
      '3 Photo Uploads',
      'Book Appointment Feature',
      'Premium Visibility',
      'Featured Listing',
      'Mabinti Community Access'
    ],
    photoUploads: 3,
    videoUploads: 0
  }
];

const SellerPackages = () => {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentStatusDialogOpen, setPaymentStatusDialogOpen] = useState(false);
  const [mpesaNumber, setMpesaNumber] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed' | null>(null);
  const [paymentStatusError, setPaymentStatusError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  const handleSelectPackage = (packageId: string) => {
    setSelectedPackage(packageId);
  };

  const handleContinue = () => {
    if (!selectedPackage) return;
    // Use custom payment values for each package
    const customAmounts: Record<string, number> = {
      basic: 5,
      standard: 10,
      premium: 15
    };
    setPaymentAmount(customAmounts[selectedPackage] || 0);
    setDialogOpen(true);
  };

  const handleMpesaPay = async () => {
    setError(null);
    if (!/^254[17][0-9]{8}$/.test(mpesaNumber)) {
      setError('Invalid phone number format. Use 2547XXXXXXXX');
      return;
    }
    
    // Use custom payment values for each package
    const customAmounts: Record<string, number> = {
      basic: 5,
      standard: 10,
      premium: 15
    };
    const amount = customAmounts[selectedPackage as string] || 0;
    setPaymentAmount(amount);
    
    setIsPaying(true);
    try {
      console.log(`Initiating STK Push for ${mpesaNumber}, amount: ${amount}`);
      const res = await axios.post('https://themabinti-com2-1.onrender.com/stkpush', {
        phoneNumber: mpesaNumber,
        amount: amount
      });
      
      console.log('STK Push response:', res.data);
      
      if (res.data.CheckoutRequestID) {
        toast.success(`STK Push sent! Complete payment of ${amount} KES on your phone.`);
        setDialogOpen(false);
        setPaymentStatusDialogOpen(true);
      } else {
        console.log('STK Push failed:', res.data.error);
        setError(res.data.error || 'Failed to initiate payment. Try again.');
      }
    } catch (err: any) {
      console.error('STK Push error:', {
        message: err.message,
        response: err.response?.data
      });
      setError('Failed to initiate payment.');
    } finally {
      setIsPaying(false);
    }
  };

  const handlePaymentConfirmed = () => {
    setPaymentStatusDialogOpen(false);
    navigate(`/signup?type=seller&package=${selectedPackage}`);
  };

  // Poll payment status when dialog is open
  useEffect(() => {
    if (paymentStatusDialogOpen && mpesaNumber) {
      setPaymentStatus('pending');
      setPaymentStatusError(null);
      
      console.log(`Starting payment status polling for ${mpesaNumber}`);
      
      pollingRef.current = setInterval(async () => {
        try {
          console.log(`Checking payment status for ${mpesaNumber}...`);
          const res = await axios.get('https://themabinti-com2-1.onrender.com/payment-status', {
            params: { phone: mpesaNumber },
          });
          
          console.log('Payment status response:', res.data);
          
          if (res.data.status === 'success') {
            console.log('Payment successful! Details:', res.data);
            setPaymentStatus('success');
            setPaymentStatusError(null);
            clearInterval(pollingRef.current!);
            setTimeout(() => {
              setPaymentStatusDialogOpen(false);
              navigate(`/signup?type=seller&package=${selectedPackage}`);
            }, 1000);
          } else if (res.data.status === 'failed') {
            console.log('Payment failed. Reason:', res.data.reason);
            setPaymentStatus('failed');
            setPaymentStatusError(res.data.reason || 'Payment failed. Please try again.');
            clearInterval(pollingRef.current!);
          } else {
            console.log('Payment still pending...');
            setPaymentStatus('pending');
            setPaymentStatusError(null);
          }
        } catch (err) {
          console.error('Error checking payment status:', err);
          setPaymentStatus('pending');
          setPaymentStatusError('Error checking payment status.');
        }
      }, 3000);
      
      return () => {
        if (pollingRef.current) {
          console.log('Clearing payment status polling');
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [paymentStatusDialogOpen, mpesaNumber, selectedPackage, navigate]);

  const handlePaymentCancelled = () => {
    setPaymentStatusDialogOpen(false);
    setMpesaNumber('');
    setPaymentStatus(null);
    setPaymentStatusError(null);
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Choose Your Seller Package</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Select a package that best suits your needs. You can upgrade or change your package anytime after registration.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {packages.map((pkg) => (
          <Card 
            key={pkg.id}
            className={`relative ${
              pkg.recommended ? 'border-2 border-purple-500' : ''
            }`}
          >
            {pkg.recommended && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <div className="bg-purple-500 text-white px-4 py-1 rounded-full text-sm flex items-center">
                  <Star className="h-4 w-4 mr-1" />
                  Recommended
                </div>
              </div>
            )}
            
            <CardHeader>
              <CardTitle className="text-xl">{pkg.name}</CardTitle>
              <CardDescription>
                <span className="text-2xl font-bold">Ksh {pkg.price}</span>
                <span className="text-gray-500">/month</span>
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {pkg.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            
            <CardFooter className="flex flex-col gap-3">
              <Button 
                variant={selectedPackage === pkg.id ? "default" : "outline"}
                className={`w-full ${
                  selectedPackage === pkg.id 
                    ? 'bg-purple-500 hover:bg-purple-600' 
                    : 'border-purple-500 text-purple-500 hover:bg-purple-50'
                }`}
                onClick={() => handleSelectPackage(pkg.id)}
              >
                {selectedPackage === pkg.id ? 'Selected' : 'Select Package'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Button 
          onClick={handleContinue}
          className="bg-purple-500 hover:bg-purple-600 px-8 py-2"
          disabled={!selectedPackage}
        >
          Continue to Checkout
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mpesa Payment</DialogTitle>
              <DialogDescription>Enter your Mpesa number (starting with 254) to pay {paymentAmount} KES and continue.</DialogDescription>
            </DialogHeader>
            <Input
              placeholder="2547XXXXXXXX"
              value={mpesaNumber}
              onChange={e => setMpesaNumber(e.target.value)}
              disabled={isPaying}
              maxLength={12}
            />
            {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
            <DialogFooter>
              <Button onClick={handleMpesaPay} disabled={isPaying} className="bg-purple-500 w-full">
                {isPaying ? 'Processing...' : 'Pay & Continue'}
              </Button>
              <DialogClose asChild>
                <Button variant="outline" disabled={isPaying}>Cancel</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={paymentStatusDialogOpen} onOpenChange={setPaymentStatusDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Payment Status</DialogTitle>
              <DialogDescription>
                STK Push has been sent to {mpesaNumber}. Please complete the payment of {paymentAmount} KES on your phone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Instructions:</strong>
                  <br />1. Check your phone for the M-Pesa prompt
                  <br />2. Enter your M-Pesa PIN when prompted
                  <br />3. Confirm the payment of {paymentAmount} KES
                  <br />4. Wait for the success message
                </p>
              </div>
              {paymentStatus === 'pending' && (
                <div className="text-center text-gray-600">Waiting for payment confirmation...</div>
              )}
              {paymentStatus === 'success' && (
                <div className="text-center text-green-600 font-semibold">Payment successful!</div>
              )}
              {paymentStatus === 'failed' && (
                <div className="text-center text-red-600 font-semibold">{paymentStatusError || 'Payment failed. Please try again.'}</div>
              )}
              {paymentStatusError && paymentStatus !== 'failed' && (
                <div className="text-center text-red-500 text-sm">{paymentStatusError}</div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handlePaymentCancelled} variant="outline">
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <p className="mt-4 text-sm text-gray-500">
          You can upgrade or change your package anytime after registration.
        </p>
      </div>
    </div>
  );
};

export default SellerPackages;
