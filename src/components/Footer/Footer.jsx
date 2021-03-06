import React, { PureComponent } from 'react';
import Layout from '@icedesign/layout';
import cx from 'classnames';
import Logo from '../Logo';

export default class Footer extends PureComponent {
  render() {
    const { className, style } = this.props;
    return (
      <Layout.Footer
        className={cx('ice-design-layout-footer', className)}
        style={{
          ...style,
          lineHeight: '36px',
        }}
      >
        <div className="ice-design-layout-footer-body">
          <div style={{ filter: 'grayscale(100%)', opacity: 0.3 }}>
           
          </div>
          <div className="copyright">
            © 2020 Theme designed by{' '}
            <a
              href="https://xChainUnion.com/"
              target="_blank"
              className="copyright-link"
              rel="noopener noreferrer"
            >
              xChainUnion
            </a>
          </div>
        </div>
      </Layout.Footer>
    );
  }
}
