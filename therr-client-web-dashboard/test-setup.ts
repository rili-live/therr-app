import 'raf/polyfill';
import { TextDecoder, TextEncoder } from 'util';
import { configure } from 'enzyme';
import Adapter from '@cfaester/enzyme-adapter-react-18';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom omits these, and react-dom/server references TextEncoder at import time
if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
    globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}

Object.defineProperty(document, 'referrer', {
    value: 'https://www.example.com',
});
configure({ adapter: new Adapter() });
