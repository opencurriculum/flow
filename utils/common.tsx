export const blockStyleFn = (formatting, block) => {
    if (formatting && formatting.textAlign)
        return `textAlign-${formatting.textAlign}`
}


var uppercase = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K',
        'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
    ],
    lowercase = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k',
        'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'
    ];

export function t(term, app){
    if (app && app.stepsAlias){
        // Very very rough pluralization check that can break easily.
        var isPlural = term.substring(term.length - 1) === 's' && (
                term.substring(term.length - 2) !== 's'),
            isCamelCase = uppercase.indexOf(term.substring(0, 1)) !== -1,
            singularTerm = term;

        if (isPlural)
            singularTerm = term.substring(0, term.length - 1);

        if (singularTerm.toLowerCase() === 'step'){
            var newTerm = app.stepsAlias.substring(0, app.stepsAlias.length - 1);

            if (isPlural)
                newTerm += 's';

            if (isCamelCase)
                newTerm = uppercase[lowercase.indexOf(
                    newTerm.substring(0, 1))] + newTerm.substring(1);

            return newTerm;
        }
    }

    return term;
}
