import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import usePortfolioAccountingDisplay from '@/hooks/usePortfolioAccountingDisplay';

export default function useAccountingRepair(){
  const accounting=usePortfolioAccountingDisplay();
  const [repairing,setRepairing]=useState(false);
  const repair=async()=>{if(!accounting.inconsistentOrderIds.length)return;setRepairing(true);await base44.entities.PaperOrder.bulkUpdate(accounting.inconsistentOrderIds.map(id=>({id,status:'settled',settlementStatus:'settled',settlementError:null})));window.location.reload();};
  return{repair,repairing,canRepair:accounting.inconsistentOrderIds.length>0};
}