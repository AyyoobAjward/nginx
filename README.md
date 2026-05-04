```
sudo tcpdump -i any -n 'tcp port 80 or tcp port 3080' -w /home/nginx-dump.pcap
```

```
scp root@165.22.245.218:/home/nginx-dump.pcap /Users/ayyoobajward/Downloads
```

![my public ip](what-is-my-ip.png)

endpoint - http://165.22.245.218/server

```json
{
  "method": "GET",
  "url": "/server",
  "httpVersion": "1.0",
  "headers": {
    "x-real-ip": "175.157.230.36",
    "x-forwarded-for": "175.157.230.36",
    "host": "165.22.245.218",
    "connection": "close",
    "cache-control": "max-age=0",
    "dnt": "1",
    "upgrade-insecure-requests": "1",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-encoding": "gzip, deflate",
    "accept-language": "en-GB,en;q=0.9"
  },
  "body": null
}
```

```tcpdump
1	0.000000	175.157.230.36	165.22.245.218	TCP	84	36569 → 80 [SYN, ECE, CWR] Seq=0 Win=65535 Len=0 MSS=1400 WS=64 TSval=1218879983 TSecr=0 SACK_PERM
2	0.000070	165.22.245.218	175.157.230.36	TCP	80	80 → 36569 [SYN, ACK, ECE] Seq=0 Ack=1 Win=65160 Len=0 MSS=1460 SACK_PERM TSval=2428520529 TSecr=1218879983 WS=64
3	0.081973	175.157.230.36	165.22.245.218	TCP	72	36569 → 80 [ACK] Seq=1 Ack=1 Win=131904 Len=0 TSval=1218880054 TSecr=2428520529
4	0.089742	175.157.230.36	165.22.245.218	HTTP	547	GET /server HTTP/1.1 
5	0.089806	165.22.245.218	175.157.230.36	TCP	72	80 → 36569 [ACK] Seq=1 Ack=476 Win=64704 Len=0 TSval=2428520619 TSecr=1218880054
6	0.089997	127.0.0.1	127.0.0.1	TCP	80	50656 → 3080 [SYN] Seq=0 Win=65495 Len=0 MSS=65495 SACK_PERM TSval=2528999029 TSecr=0 WS=64
7	0.090013	127.0.0.1	127.0.0.1	TCP	80	3080 → 50656 [SYN, ACK] Seq=0 Ack=1 Win=65483 Len=0 MSS=65495 SACK_PERM TSval=2528999029 TSecr=2528999029 WS=64
8	0.090028	127.0.0.1	127.0.0.1	TCP	72	50656 → 3080 [ACK] Seq=1 Ack=1 Win=65536 Len=0 TSval=2528999029 TSecr=2528999029
9	0.090080	127.0.0.1	127.0.0.1	HTTP	602	GET /server HTTP/1.0 
10	0.090084	127.0.0.1	127.0.0.1	TCP	72	3080 → 50656 [ACK] Seq=1 Ack=531 Win=64960 Len=0 TSval=2528999029 TSecr=2528999029
11	0.090261	172.17.0.1	172.17.0.2	TCP	80	49452 → 3080 [SYN] Seq=0 Win=64240 Len=0 MSS=1460 SACK_PERM TSval=1235496856 TSecr=0 WS=64
```