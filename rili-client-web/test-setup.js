import 'raf/polyfill'; // eslint-disable-line import/no-extraneous-dependencies
import { configure } from 'enzyme'; // eslint-disable-line import/no-extraneous-dependencies
import * as Adapter from 'enzyme-adapter-react-16'; // eslint-disable-line import/no-extraneous-dependencies

Object.defineProperty(document, 'referrer', {
    value: 'https://www.example.com',
});
configure({ adapter: new Adapter() });
