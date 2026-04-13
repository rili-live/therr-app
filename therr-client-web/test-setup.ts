import 'raf/polyfill'; // eslint-disable-line import/extensions,import/no-extraneous-dependencies
import { configure } from 'enzyme';
import Adapter from '@cfaester/enzyme-adapter-react-18';

declare global {
    // eslint-disable-next-line no-var, vars-on-top
    var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Mantine components require ResizeObserver which jsdom doesn't provide
globalThis.ResizeObserver = class ResizeObserver {
    // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-empty-function
    observe() {}

    // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-empty-function
    unobserve() {}

    // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-empty-function
    disconnect() {}
};

Object.defineProperty(document, 'referrer', {
    value: 'https://www.example.com',
});
configure({ adapter: new Adapter() });
