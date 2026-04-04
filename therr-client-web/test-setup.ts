import 'raf/polyfill'; // eslint-disable-line import/extensions
import { configure } from 'enzyme';
import Adapter from '@cfaester/enzyme-adapter-react-18';

declare global {
    // eslint-disable-next-line no-var
    var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Mantine components require ResizeObserver which jsdom doesn't provide
globalThis.ResizeObserver = class ResizeObserver {
    observe() {}

    unobserve() {}

    disconnect() {}
};

Object.defineProperty(document, 'referrer', {
    value: 'https://www.example.com',
});
configure({ adapter: new Adapter() });
