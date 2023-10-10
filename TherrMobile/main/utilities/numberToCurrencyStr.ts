const numberToCurrencyStr = (amount: number) => {
    let strAmount = amount.toString();
    if (strAmount.charAt(strAmount.length - 2) === '.') {
        strAmount = `${strAmount}0`;
    }

    return strAmount;
};

export default numberToCurrencyStr;
