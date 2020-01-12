import React from 'react';
import IceContainer from '@icedesign/container';
import { Icon, Button } from '@alifd/next';
import styles from './index.module.scss';

const generatorData = () => {
    return [
            {
              title: 'QuarkChain官方完整资料',
              href: 'https://github.com/QuarkChain/pyquarkchain/wiki',
              author: 'quarkchain team',
              date: '2020-1-12 14:30',
            }
          ]
};

export default function Index() {
  const dataSource = generatorData();

  return (
    <div className="article-list">
      {/* <IceContainer className={styles.articleFilterCard}>
        <ul className={`${"article-sort"} ${styles.articleSort}`}>
          <li className={styles.sortItem}>
            最新 <Icon type="arrow-down" size="xs" />
          </li>
          <li className={styles.sortItem}>
            最热 <Icon type="arrow-down" size="xs" />
          </li>
        </ul>
      </IceContainer> */}
      <IceContainer>
        {dataSource.map((item, index) => {
          return (
            <div key={index} className={styles.articleItem}>
              <div>
                <a className={styles.title} href={item.href} target='_blank'>
                  {item.title}
                </a>
              </div>
              <div className={styles.articleItemFooter}>                
                <div className={styles.articleItemMeta}>
                  {/* <span className={styles.itemMetaIcon}>
                    <Icon type="good" size="small" /> {item.like}
                  </span> */}
                  <span className={styles.itemMetaIcon}>
                    <Icon type="account" size="small" /> {item.author}
                  </span>
                  <span className={styles.itemMetaIcon}>
                    <Icon type="clock" size="small" /> {item.date}
                  </span>
                </div>             
              </div>
            </div>
          );
        })}
      </IceContainer>
    </div>
  );
}