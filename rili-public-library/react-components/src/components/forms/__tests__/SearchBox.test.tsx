import * as React from 'react';
import { mount } from 'enzyme'; // tslint:disable-line no-implicit-dependencies
import { Key as KeyCode } from 'ts-keycode-enum';
import SearchBox from '../SearchBox';

describe('SearchBox', () => {
    let wrapper: any = null;
    const mockSearch = jest.fn();
    const mockTranslate = (key: any) => key;
    const searchBoxName = 'text-search-box';

    beforeEach(() => {
        wrapper = mount(
            <SearchBox
                id={searchBoxName}
                labelText="Search Box"
                name={searchBoxName}
                onChange={jest.fn()}
                onSearch={mockSearch}
                translate={mockTranslate}
                value=""
            />,
        );
    });

    afterEach(() => {
        wrapper.unmount();
    });

    function simulateKeyDown(keyCode: any) {
        const element = wrapper.find('input');
        element.simulate('keyDown', { keyCode });
    }

    it('applies and removes "is-dirty" class when text is added and removed', () => {
        const expectedValue = 'Test entry';
        wrapper.instance().handleInputChange(expectedValue, searchBoxName);
        const inputWrapper = wrapper.find('Input');
        inputWrapper.instance().handleInputChange({
            target: {
                name: searchBoxName,
                value: expectedValue,
            },
        });
        wrapper.update();
        expect(wrapper.state().inputValue).toBe(expectedValue);
        expect(wrapper.find('.search-box').hasClass('is-dirty')).toBe(true);
        inputWrapper.instance().handleInputChange({
            target: {
                name: searchBoxName,
                value: '',
            },
        });
        wrapper.update();
        expect(wrapper.state().inputValue).toBe('');
        expect(wrapper.find('.search-box').hasClass('is-dirty')).toBe(false);
        expect(wrapper.props().onChange).toHaveBeenCalledTimes(3);
    });

    it('calls onSearch prop when enter key is pressed', () => {
        const testInput = 'Test input';
        wrapper.setState({
            inputValue: testInput,
        });
        wrapper.update();
        simulateKeyDown(KeyCode.Enter);
        expect(mockSearch).toHaveBeenCalledTimes(1);
        expect(mockSearch).toHaveBeenCalledWith(expect.anything(), testInput);
    });

    it('updates search text based on props', () => {
        const testInput = 'Utahraptor input';
        wrapper.setProps({
            value: testInput,
        });
        wrapper.update();

        expect(wrapper.find('Input').prop('value')).toBe(testInput);
    });
});
