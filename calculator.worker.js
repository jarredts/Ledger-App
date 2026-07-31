// CALCULATOR WORKER - BACKGROUND DEBT & CUMULATIVE MATH ENGINE
self.onmessage = function(e) {
  const { state, activeForecastMode, selectedLiquidAccountIds, selectedDebtAccountIds, targetDateStr } = e.data;

  function parseLocalDate(dateStr) {
    const p = dateStr.split('-');
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function isAccountActive(accId) {
    if (activeForecastMode === 'liquid') {
      if (selectedLiquidAccountIds.includes('all')) return true;
      return selectedLiquidAccountIds.includes(accId);
    } else {
      if (selectedDebtAccountIds.includes('all')) return true;
      return selectedDebtAccountIds.includes(accId);
    }
  }

  let totalBalance = 0;

  if (activeForecastMode === 'debt') {
    let totalDebt = 0;
    if (state.debts) {
      state.debts.forEach(d => {
        if (!isAccountActive(`debt-${d.id}`)) return;

        const debtStartDate = d.startDate ? parseLocalDate(d.startDate) : parseLocalDate('2026-01-01');
        const targetDate = parseLocalDate(targetDateStr);
        if (targetDate < debtStartDate) return;

        let curBal = d.balance;
        let cur = new Date(debtStartDate);

        let promoEndDate = null;
        if (d.promoEnabled && d.promoEndDate) {
          promoEndDate = parseLocalDate(d.promoEndDate);
        } else if (d.promoMonths && parseInt(d.promoMonths) > 0) {
          promoEndDate = new Date(debtStartDate);
          promoEndDate.setMonth(promoEndDate.getMonth() + parseInt(d.promoMonths));
        }

        while (cur <= targetDate && curBal > 0) {
          const k = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');

          if (d.closingDate && cur.getDate() === parseInt(d.closingDate) && cur > debtStartDate) {
            let activeApr = d.apr;
            if (promoEndDate && cur <= promoEndDate) {
              activeApr = d.promoApr !== undefined ? parseFloat(d.promoApr) : 0;
            }
            const monthlyRate = (activeApr / 100) / 12;
            curBal += curBal * monthlyRate;
          }

          if (d.dueDate && cur.getDate() === parseInt(d.dueDate)) {
            const excKey = `debt-pay-${d.id}_${k}`;
            if (!state.exceptions || !state.exceptions[excKey] || !state.exceptions[excKey].skipped) {
              const pmt = Math.min(curBal, d.minPayment);
              curBal -= pmt;
            }
          }

          if (state.transactions) {
            const debtTxs = state.transactions.filter(t => t.accountId === `debt-${d.id}` && t.date === k);
            debtTxs.forEach(t => {
              if (t.type === 'expense') curBal += t.amount;
              else if (t.type === 'income') curBal -= t.amount;
            });
          }

          cur.setDate(cur.getDate() + 1);
        }

        totalDebt += Math.max(0, curBal);
      });
    }
    totalBalance = -totalDebt;
  } else {
    let startingBase = 0;
    if (state.accounts) {
      startingBase = state.accounts
        .filter(a => isAccountActive(a.id))
        .reduce((s, a) => s + a.balance, 0);
    }

    let txDelta = 0;
    if (state.transactions) {
      txDelta = state.transactions
        .filter(t => isAccountActive(t.accountId) && t.date <= targetDateStr)
        .reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
    }

    totalBalance = startingBase + txDelta;
  }

  self.postMessage({ targetDateStr, totalBalance });
};
