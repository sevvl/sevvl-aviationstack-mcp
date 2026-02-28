/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                useESM: true,
                tsconfig: {
                    module: 'ESNext',
                    target: 'ES2022',
                },
            },
        ],
    },
    transformIgnorePatterns: [
        'node_modules/(?!(axios)/)',
    ],
    globals: {
        'ts-jest': {
            useESM: true,
        },
    },
};
