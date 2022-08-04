export const blockStyleFn = (formatting, block) => {
    if (formatting && formatting.textAlign)
        return `textAlign-${formatting.textAlign}`
}
