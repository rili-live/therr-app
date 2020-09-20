import generator from 'generate-password';

export default (length) => generator.generate({
    length,
    numbers: true,
});
