import 'raf/polyfill'; // eslint-disable-line import/no-extraneous-dependencies
import { configure } from 'enzyme'; // eslint-disable-line import/no-extraneous-dependencies
import Adapter from 'enzyme-adapter-react-16'; // eslint-disable-line import/no-extraneous-dependencies

configure({ adapter: new Adapter() });
