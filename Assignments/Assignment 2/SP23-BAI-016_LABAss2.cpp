#include <iostream>
#include <unistd.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <cstring>

using namespace std;

#define MAX 100

int RowSum(int matrix[MAX][MAX],int row, int n) {
    int sum=0;
    for (int j=0;j<n;j++) {
        sum+=matrix[row][j];
    }
    return sum;
}
int ColumnSum(int matrix[MAX][MAX],int col,int n) {
    int sum=0;
    for (int i=0;i<n;i++) {
        sum+=matrix[i][col];
    }
    return sum;
}

int DiagonalSum(int matrix[MAX][MAX],int n) {
    int sum=0;
    for (int i=0;i<n;i++) {
        sum+=matrix[i][i];
    }
    return sum;
}
int TrailingDiagonalSum(int matrix[MAX][MAX],int n) {
    int sum=0;
    for (int i=0;i < n;i++) {
        sum+=matrix[i][n-i-1];
    }
    return sum;
}

bool isMagic(int matrix[MAX][MAX],int n) {
    int fd[2];
    pipe(fd);
    pid_t pid1 = fork();
    if (pid1==0){
        int rowSum=RowSum(matrix,0,n);
        for (inti=1;i<n;i++) {
            if (RowSum(matrix,i,n)!=rowSum) {
                write(fd[1],&rowSum,sizeof(rowSum));
                exit(0);
            }
        }
        write(fd[1], &rowSum,sizeof(rowSum));
        exit(0);
    }

    pid_t pid2=fork();
    if (pid2==0){
        int colSum=ColumnSum(matrix,0,n);
        for (int i=1;i<n;i++) {
            if (ColumnSum(matrix,i,n)!=colSum) {
                write(fd[1],&colSum,sizeof(colSum));
                exit(0);
            }
        }
        write(fd[1],&colSum,sizeof(colSum));
        exit(0);
    }

    int rowSum,colSum;
    read(fd[0],&rowSum,sizeof(rowSum));
    read(fd[0],&colSum,sizeof(colSum));
    wait(NULL);
    wait(NULL);

    int maindiagonalsum=DiagonalSum(matrix,n);
    int trailingdiagonalsum=TrailingDiagonalSum(matrix,n);

    if (rowSum==colSum&&colSum==maindiagonalsum&&maindiagonalsum==trailingdiagonalsum) {
        cout<<"The matrix is a magic square: "<<rowSum<<endl;
        return true;
    } else {
        cout<<"The matrix is NOT a magic square."<<endl;
        return false;
    }
}

int main() {
    int n;
    cout << "Enter the size of the square matrix (n x n): ";
    cin>>n;
    int matrix[MAX][MAX];
    cout << "Enter the elements of the matrix: \n";
    for (int i=0;i<n;i++) {
        for (int j=0;j<n;j++) {
            cin>>matrix[i][j];
        }
    }
    is_magic(matrix, n);

    return 0;
}
