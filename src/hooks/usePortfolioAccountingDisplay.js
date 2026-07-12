import { useApp } from '@/lib/AppContext';

export default function usePortfolioAccountingDisplay(){
  return useApp().accounting;
}