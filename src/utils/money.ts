export const integerMoney = (value: unknown) => {
    if (typeof value !== 'number' || !Number.isInteger(value)){
        return 'Bu alan sadece tam sayı kabul eder.'
    }
    return true
}